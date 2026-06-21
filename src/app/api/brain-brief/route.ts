import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// 「現在のマーケ・ブリーフ」を脳に保持する。別セッション(CC)が生成したブリーフを
// POSTで流し込み→兄さんが参照＋「📌今のフォーカス」を表示。focus未指定ならAIが要約生成。
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
const KEY = 'samurai:brain-brief'

export async function GET() {
  try {
    const brief = await redis.get<any>(KEY)
    return NextResponse.json({ brief: brief || null })
  } catch {
    return NextResponse.json({ brief: null })
  }
}

export async function POST(request: Request) {
  try {
    const { text, focus } = await request.json()
    if (!text || !String(text).trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

    let f = focus && String(focus).trim() ? String(focus).trim() : ''
    // focus未指定なら、ブリーフ本文から「今のフォーカス」をAIが自動生成
    if (!f && process.env.ANTHROPIC_API_KEY) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 500,
            system: '次のマーケ・ブリーフから、自社マーケ担当が「今、頭に入れておくべき現状」を3〜4行で抽出。各行「- 」始まり、簡潔・装飾控えめ。観点=①自社の今の状態 ②競合・市場で起きている変化 ③注意すべき動き。【禁止】「〜せよ」「〜を通す」「〜が急務」などの"やること・締切・指示"は書かない（それはタスク管理の領域）。あくまで状態・事実・変化として書く。創作せずブリーフ内の事実だけ。',
            messages: [{ role: 'user', content: String(text).slice(0, 12000) }],
          }),
        })
        const d = await res.json()
        f = d.content?.[0]?.text?.trim() || ''
      } catch { /* 生成失敗は空でOK */ }
    }

    const brief = { text: String(text).slice(0, 14000), focus: f, updatedAt: new Date().toISOString() }
    await redis.set(KEY, brief)
    return NextResponse.json({ ok: true, focus: f })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
