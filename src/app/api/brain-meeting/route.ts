import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// ===== 定例キャッチアップ =====
// マーケ定例の文字起こし(VTT→整形済みテキスト)を受け取り、Haikuで「背景ゼロの自社マーケ担当」向けに
// 噛み砕いたダイジェスト(30秒サマリー/決まったこと/あなたがやること/用語/確認事項/SAMURAIへの意味)に変換して保存する。
// 兄さん(/api/brain)はこの定例ダイジェストも記憶に取り込み、後から「あの定例で〜」に答えられる。

export const maxDuration = 60

const MODEL = 'claude-haiku-4-5-20251001'
const KEY = 'samurai:brain-meetings'

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null

const SYSTEM = `あなたはSAMURAI ARCHITECTS（建築×AIのスタートアップ。プロダクト=Rendery[AI建築パース]/knock knock AI[空室のバーチャルステージング]/VISIOAL[企画段階の空間ビジュアル]/カスタム[図面のBIM化等の受託]）の、自社マーケ担当者専属の「兄さん」です。相手は建築もマーケも背景ゼロ。
渡すのは「マーケ定例(ミーティング)の文字起こし」です。自動文字起こしなので誤変換・聞き取りミス・言い淀みが混じります。これを、背景ゼロの本人が"30秒で会議に追いつける"ダイジェストに変換してください。

ルール:
- 平易な言葉で（中学生でも分かる）。専門用語・社内用語・略語・人名は、出てきたら terms に「超平易な一言解説」付きで入れる。
- 文字起こしに実際に出た話だけを使う。創作しない。聞き取りが怪しい固有名詞・数字は「(要確認)」と添える。
- 「決まったこと」と「やること」は、実際に合意・指示された範囲だけ。憶測で増やさない。
- 「あなたがやること(myActions)」＝自社マーケ担当(＝この読者)が当事者として動く/関わるものだけを抜く。他人の宿題は入れない。
- soWhat＝この定例がSAMURAIのマーケ/今の戦況にとって何を意味するか・次の一手を1〜2文で。

結果は digest ツールを呼んで登録してください。各配列は重要なものに絞る（terms最大20・decisions/myActions/checksは各最大15）。該当が無い配列は空でよい。盛らずに、要点だけ正確に。`

// 構造化出力を強制するためのツール定義（生JSONを書かせず壊れないようにする）
const DIGEST_TOOL = {
  name: 'digest',
  description: 'マーケ定例の文字起こしを噛み砕いたダイジェストとして登録する',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '会議の主題を短く' },
      summary: { type: 'string', description: '全体像が30秒で掴める2〜3文' },
      decisions: { type: 'array', items: { type: 'string' }, description: '実際に合意・決定したことだけ' },
      myActions: { type: 'array', items: { type: 'string' }, description: '自社マーケ担当(読者本人)が動く/関わることだけ。他人の宿題は入れない' },
      terms: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, plain: { type: 'string' } }, required: ['term', 'plain'] }, description: '出てきた専門用語・社内語・略語・人名の超平易な解説' },
      checks: { type: 'array', items: { type: 'string' }, description: '確認したほうがいいこと・引っかかり・宿題' },
      soWhat: { type: 'string', description: 'SAMURAIマーケにとっての意味と次の一手' },
    },
    required: ['title', 'summary', 'decisions', 'myActions', 'terms', 'checks', 'soWhat'],
  },
}

export async function GET() {
  try {
    const meetings = redis ? ((await redis.get<any[]>(KEY)) || []) : []
    return NextResponse.json({ meetings })
  } catch {
    return NextResponse.json({ meetings: [] })
  }
}

// 1件削除(?id=)／全消し(?all=1)。誤アップロードを消せるように。
export async function DELETE(request: Request) {
  try {
    if (!redis) return NextResponse.json({ ok: false })
    const url = new URL(request.url)
    if (url.searchParams.get('all') === '1') { await redis.set(KEY, []); return NextResponse.json({ ok: true, meetings: [] }) }
    const id = url.searchParams.get('id')
    const existing = (await redis.get<any[]>(KEY)) || []
    const meetings = id ? existing.filter((m: any) => m?.id !== id) : existing
    await redis.set(KEY, meetings)
    return NextResponse.json({ ok: true, meetings })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY未設定（本番でのみAIが動きます）' }, { status: 500 })
  try {
    const { transcript, name } = await request.json()
    const text = String(transcript || '').trim()
    if (text.length < 40) return NextResponse.json({ error: '文字起こしが短すぎます（VTTの中身を読み取れませんでした）' }, { status: 400 })

    // 現在のブリーフ（戦況）を少しだけ文脈に足す＝soWhatが今の自社に接続する
    let briefBlock = ''
    try {
      const brief = redis ? await redis.get<any>('samurai:brain-brief') : null
      if (brief?.text) briefBlock = `\n\n# 参考：今のSAMURAIの戦況（soWhatを今に接続するため）\n${String(brief.text).slice(0, 2500)}`
    } catch { /* 任意 */ }

    const truncated = text.length > 120000
    const body = `${truncated ? '（長いため冒頭〜途中までを抜粋）\n' : ''}${text.slice(0, 120000)}`

    // ツール呼び出しで構造化出力を強制＝生JSONを書かせず壊れない（長い定例での途中切れ・JSON崩れを防ぐ）
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 8000, system: SYSTEM + briefBlock,
        tools: [DIGEST_TOOL], tool_choice: { type: 'tool', name: 'digest' },
        messages: [{ role: 'user', content: `次のマーケ定例の文字起こしをダイジェストにして：\n\n${body}` }],
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: `AIエラー(${res.status})。少し待って再度お試しください`, detail: data?.error?.message }, { status: 502 })
    // 第一候補＝ツール出力(クリーンなオブジェクト)。無ければテキストからJSONを救出（trailing comma/制御文字を掃除）
    let dg: any = data.content?.find((c: any) => c.type === 'tool_use')?.input
    if (!dg || typeof dg !== 'object') {
      const raw = data.content?.find((c: any) => c.type === 'text')?.text || ''
      try {
        let t = raw.replace(/```json|```/g, '').trim()
        t = t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1).replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001F]+/g, ' ')
        dg = JSON.parse(t)
      } catch {
        return NextResponse.json({ error: 'ダイジェストの生成に失敗しました。もう一度お試しください', stop: data?.stop_reason }, { status: 502 })
      }
    }

    const now = new Date()
    const meeting = {
      id: 'mtg_' + now.getTime(),
      name: String(name || '定例').slice(0, 80),
      title: String(dg.title || 'マーケ定例').slice(0, 120),
      summary: String(dg.summary || ''),
      decisions: Array.isArray(dg.decisions) ? dg.decisions.map(String).slice(0, 20) : [],
      myActions: Array.isArray(dg.myActions) ? dg.myActions.map(String).slice(0, 20) : [],
      terms: Array.isArray(dg.terms) ? dg.terms.filter((x: any) => x && x.term).slice(0, 30).map((x: any) => ({ term: String(x.term).slice(0, 60), plain: String(x.plain || '').slice(0, 240) })) : [],
      checks: Array.isArray(dg.checks) ? dg.checks.map(String).slice(0, 20) : [],
      soWhat: String(dg.soWhat || ''),
      truncated,
      createdAt: now.toISOString(),
    }

    if (redis) {
      const existing = (await redis.get<any[]>(KEY)) || []
      await redis.set(KEY, [meeting, ...existing].slice(0, 12))
    }
    return NextResponse.json({ meeting })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
