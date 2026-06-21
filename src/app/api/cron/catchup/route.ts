import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { fetchTrendItemsFlat, fetchKeywordNews } from '@/lib/sources'
import { WATCH } from '@/lib/watch'

// ===== キャッチアップくん（子）=====
// 毎朝Web（建築・AI・競合ニュース）を拾い → 新着だけ → AIが「一言／自社への判定／だから」を付けて
// → 脳の記憶 samurai:brain-feed に投入する。脳(/api/brain)はこのfeedを参照して最新を踏まえて答える。
// Vercel Cron（vercel.json）から毎朝GET。画面の「今すぐ拾う」ボタンからも同じGETを叩ける。

export const maxDuration = 60

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const FEED = 'samurai:brain-feed'
const SEEN = 'samurai:brain-seen'
const LOG = 'samurai:brain-runs'

const norm = (s: string) => (s || '').toLowerCase().replace(/[\s　・|｜\-—–、。．,.()（）\[\]「」【】]/g, '')

const SYSTEM = `あなたはSAMURAI ARCHITECTS の情報キャッチアップ係です。SAMURAIのプロダクト=Rendery(AI建築パース/レンダリング生成)・knock knock AI(空室のバーチャルステージング)・VISIOAL(企画段階の空間ビジュアル)・カスタム(図面のBIM化・図面解析の受託)。
【SAMURAIのレーン】＝①建築パース/レンダリング生成 ②バーチャルステージング ③企画ビジュアル ④図面→BIM化/図面解析、および「その直接・隣接競合」「業界の制度(BIM審査/2024年問題/補助金/i-Construction)」「顧客(工務店/不動産仲介/デベロッパー/大手建設)の動向」。これ以外はレーン外。

以下は業界ニュースの「見出し」リスト(本文未取得)。各見出しを次のJSONに変換し、JSON配列だけ返す(説明・コードフェンス禁止)。
{"idx":元番号,"oneLine":"中学生にも分かる一言","verdict":"competitor|threat|tailwind|research|none","soWhat":"自社マーケ/営業にどう効くか1文(noneなら空でよい)"}
判定: competitor=パース/ステージング/企画ビジュアル/BIM受託の直接・隣接競合の動き / threat=汎用AI・価格破壊などの脅威 / tailwind=自社に効く制度・需要・調査データ / research=学術・研究でまだ実務に遠い / none=レーン外。
【必ずnoneにする】単体の施工管理ツール・測位/位置管理・3Dプリンター建築・一般の啓発講演や教育講座・CG技術者向けのイベント/ワークショップ告知・アート/復元など、SAMURAIの4製品と直接関係しない話題。重複・ほぼ同内容も none。迷ったら none。
本文が無いので断定や数字の創作はしない。`

const EMOJI: Record<string, string> = { competitor: '🔴競合', threat: '⚠️脅威', tailwind: '🟢追い風', research: '🎓研究', none: '⚪無関係' }

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(request.url)
  const limit = Math.min(12, Math.max(1, Number(url.searchParams.get('limit')) || 8))

  try {
    // 通常の業界ニュース＋ウォッチ中の人/企業のニュースを合わせて拾う
    const [base, watchGroups] = await Promise.all([
      fetchTrendItemsFlat(3),
      Promise.all(WATCH.filter(w => w.news).map(w => fetchKeywordNews(w.news, 2))),
    ])
    const watchItems = watchGroups.flatMap(g => g.items.filter(i => i.title).map(i => ({ ...i, keyword: g.keyword })))
    const items = [...base, ...watchItems]
    const seen: string[] = ((await redis.get(SEEN)) as string[]) || []
    const seenSet = new Set(seen.map(norm))

    const fresh: typeof items = []
    for (const it of items) {
      if (fresh.length >= limit) break
      if (seenSet.has(norm(it.title))) continue
      if (fresh.some(p => norm(p.title) === norm(it.title))) continue
      fresh.push(it)
    }

    if (fresh.length === 0) {
      await pushLog({ at: new Date().toISOString(), scanned: items.length, added: 0, note: '新規なし' })
      return NextResponse.json({ added: 0, scanned: items.length, message: '新しい新着はありませんでした' })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })

    const listText = fresh.map((it, i) => `${i}. 「${it.title}」（媒体: ${it.source || '不明'} / KW: ${it.keyword}）`).join('\n')
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, system: SYSTEM, messages: [{ role: 'user', content: listText }] }),
    })
    const data = await res.json()
    const raw = data.content?.find((c: any) => c.type === 'text')?.text || data.content?.[0]?.text || ''
    let judged: any[] = []
    try {
      const t = raw.replace(/```json|```/g, '').trim()
      judged = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1))
    } catch {
      return NextResponse.json({ error: 'AI応答の解析に失敗', raw: raw.slice(0, 300) }, { status: 502 })
    }

    const now = new Date()
    const added = judged.map((j: any, i: number) => {
      const src = fresh[typeof j.idx === 'number' ? j.idx : i] || fresh[i]
      if (!src) return null
      const verdict = EMOJI[j.verdict] ? j.verdict : 'none'
      const badge = EMOJI[verdict]
      const oneLine = j.oneLine || src.title
      const soWhat = j.soWhat || ''
      return {
        id: 'feed_' + now.getTime() + '_' + i + Math.random().toString(36).slice(2, 6),
        title: src.title,
        link: src.link || '',
        source: src.source || '',
        keyword: src.keyword || '',
        verdict, badge, oneLine, soWhat,
        // 脳(/api/brain)が読む用の1行サマリ
        text: `[${badge}] ${src.title}（${src.source || '媒体不明'}）: ${oneLine} → ${soWhat}`,
        createdAt: now.toISOString(),
      }
    }).filter((x: any) => x && x.verdict !== 'none') // 無関係はフィードに入れない（AIの判定をフィルターに使う）

    const existing: any[] = ((await redis.get(FEED)) as any[]) || []
    await redis.set(FEED, [...added, ...existing].slice(0, 60))
    await redis.set(SEEN, [...fresh.map(f => f.title), ...seen].slice(0, 800))
    await pushLog({ at: now.toISOString(), scanned: items.length, added: added.length })

    return NextResponse.json({ added: added.length, scanned: items.length, items: added })
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
