import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { fetchTrendItemsFlat } from '@/lib/sources'

// ===== リサーチャー自走バッチ =====
// Vercel Cron（vercel.json）から定期実行され、人手なしで以下を回す：
//   新しい業界・競合ニュースを収集 → 重複除去 → AIが従業員向けインサイト草案を生成
//   → 下書きとして samurai:insights に投入（公開は人がレビューして判断＝品質ゲート）
// 手動トリガー（画面の「今すぐ自動収集」ボタン）からも同じGETを叩ける。

export const maxDuration = 60

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const INSIGHTS = 'samurai:insights'
const SEEN = 'samurai:researcher-seen'
const BRIEF = 'samurai:researcher-brief'
const LOG = 'samurai:researcher-runs'

const CATEGORIES = ['競合動向', '業界トレンド', '顧客・市場', '技術・プロダクト', '自社への示唆']
const OUR_PRODUCTS = ['Rendery', 'knock knock 3D', 'knock knock AI', 'VISIOAL', 'カスタムソリューション']

const FALLBACK_BRIEF = `SAMURAI ARCHITECTS × THE MOLTSは建築・建設業界向けに ${OUR_PRODUCTS.join('、')} を展開。
読み手は自社の従業員で、目的は「学び・気づき・実行・貢献」。
品質基準：①具体性 ②必ず自社プロダクトとの関わりを示す ③従業員が明日とれる行動に落とす ④最大値の誇張を避け中央値で正直に（ソースに無い数字は創作しない／不確実は不確実と明記）。`

const norm = (s: string) => (s || '').toLowerCase().replace(/[\s　・|｜\-—–、。．,.()（）\[\]「」【】]/g, '')

interface Draft {
  title: string; category: string; summary: string; points?: string[]
  relevance: string; products: string[]; soWhat: string; actions: string[]
}

export async function GET(request: Request) {
  // 任意のガード：CRON_SECRET が設定されていれば Bearer 認証を要求（未設定なら誰でも実行可）
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const limit = Math.min(5, Math.max(1, Number(url.searchParams.get('limit')) || 4))

  try {
    const items = await fetchTrendItemsFlat(3)
    const seen: string[] = ((await redis.get(SEEN)) as string[]) || []
    const seenSet = new Set(seen.map(norm))
    const existing: any[] = ((await redis.get(INSIGHTS)) as any[]) || []
    const existingTitles = new Set(existing.map((e: any) => norm(e.title)))

    // 既読でも既存インサイトでもない新着だけを対象に
    const fresh = items.filter(it => !seenSet.has(norm(it.title)) && !existingTitles.has(norm(it.title)))
    // キーワード重複を避けつつ上位 limit 件
    const picked: typeof fresh = []
    for (const it of fresh) {
      if (picked.length >= limit) break
      if (picked.some(p => norm(p.title) === norm(it.title))) continue
      picked.push(it)
    }

    if (picked.length === 0) {
      await pushLog({ at: new Date().toISOString(), scanned: items.length, created: 0, note: '新規ソースなし' })
      return NextResponse.json({ created: 0, scanned: items.length, message: '新規の収集対象はありませんでした' })
    }

    const briefObj = (await redis.get(BRIEF)) as { brief?: string } | null
    const brief = (briefObj?.brief || '').trim() || FALLBACK_BRIEF

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })

    const system = `# リサーチャー・ブリーフ（判断の土台。必ず沿う）
${brief}

---

あなたはSAMURAI ARCHITECTSのリサーチャーです。以下は業界・競合ニュースの「見出し」リストです。
各見出しを、従業員が読んで学び・行動できるインサイト草案に変換してください。
【重要】手元にあるのは見出しと媒体名のみ。本文は未取得です。見出しから読み取れる範囲で書き、断定できない点は「（要・本文確認）」と明記し、数字や事実を創作しないでください。
各見出しにつき次のJSONオブジェクトを作り、JSON配列だけを返す（説明・コードフェンスなし）：
{"idx": 元の番号, "title": "従業員向けの見出し", "category": "${CATEGORIES.join('|')} のいずれか", "summary": "見出しから言える要点を1〜2文（不確実は明記）", "relevance": "${OUR_PRODUCTS.join('/')} のどれにどう関わりうるか（仮説可・要確認と明記）", "products": ["関連プロダクト 0〜複数"], "soWhat": "従業員にとっての着眼点", "actions": ["まず元記事を確認する等、次の一手を1〜2個"]}`
    const listText = picked.map((it, i) => `${i}. 「${it.title}」（媒体: ${it.source || '不明'} / 検索KW: ${it.keyword}）`).join('\n')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, system, messages: [{ role: 'user', content: listText }] }),
    })
    const data = await res.json()
    const raw = data.content?.find((c: any) => c.type === 'text')?.text || data.content?.[0]?.text || ''
    let drafts: (Draft & { idx?: number })[] = []
    try {
      const t = raw.replace(/```json|```/g, '').trim()
      const s = t.indexOf('['), e = t.lastIndexOf(']')
      drafts = JSON.parse(t.slice(s, e + 1))
    } catch {
      return NextResponse.json({ error: 'AI応答の解析に失敗', raw: raw.slice(0, 300) }, { status: 502 })
    }

    const now = new Date()
    const created = drafts.map((d, i) => {
      const src = picked[typeof d.idx === 'number' ? d.idx : i] || picked[i]
      return {
        id: 'ins_auto_' + now.getTime() + '_' + i + Math.random().toString(36).slice(2, 6),
        title: d.title || src?.title || '（無題）',
        category: CATEGORIES.includes(d.category) ? d.category : '業界トレンド',
        summary: d.summary || '',
        points: Array.isArray(d.points) ? d.points : [],
        relevance: d.relevance || '',
        products: Array.isArray(d.products) ? d.products.filter((p: string) => OUR_PRODUCTS.includes(p)) : [],
        soWhat: d.soWhat || '',
        actions: Array.isArray(d.actions) ? d.actions : [],
        sourceType: 'auto',
        sourceRef: src?.link || '',
        status: 'draft' as const,
        reactions: { helpful: 0, learned: 0 },
        author: '🤖 自動収集',
        createdAt: now.toISOString(),
        publishedAt: '',
      }
    }).filter(d => d.title)

    const updatedInsights = [...created, ...existing].slice(0, 300)
    await redis.set(INSIGHTS, updatedInsights)
    const newSeen = [...picked.map(p => p.title), ...seen].slice(0, 800)
    await redis.set(SEEN, newSeen)
    await pushLog({ at: now.toISOString(), scanned: items.length, created: created.length, titles: created.map(c => c.title) })

    return NextResponse.json({ created: created.length, scanned: items.length, titles: created.map(c => c.title) })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function pushLog(entry: any) {
  try {
    const log: any[] = ((await redis.get(LOG)) as any[]) || []
    await redis.set(LOG, [entry, ...log].slice(0, 50))
  } catch {}
}
