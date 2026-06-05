import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:knowledge'

export async function POST(request: Request) {
  try {
    const { text, sourceTitle } = await request.json()

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 6000,
        messages: [{
          role: 'user',
          content: `以下のソースを読んで、各カテゴリに該当する箇所を抽出してください。
該当なしの場合はそのカテゴリを出力しないでください。
発言はできるだけ原文のまま引用してください。

カテゴリ定義：
・加藤CEOペルソナ：加藤CEOが思想・比喩・ビジョンを語っている発言
・商談ログ：顧客・見込み客の課題・反応
・競合情報：競合他社への言及
・業界インサイト：業界全体の動向・数字
・施策・アクション：今後の打ち手・決定事項
・顧客事例：具体的な導入事例・成果

JSONのみ返してください：
{"entries":[{"category":"カテゴリ名","content":"抽出内容（markdown形式）"}]}

ソース：
${text.slice(0, 40000)}`
        }]
      })
    })

    const data = await res.json()
    const raw = data.content?.[0]?.text || ''
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

    const existing: any[] = (await redis.get(KEY) as any[]) || []
    const now = new Date().toLocaleDateString('ja-JP')

    const labelMap: Record<string, string> = {
      '加藤CEOペルソナ': '加藤CEOペルソナ',
      '商談ログ': '商談ログ',
      '競合情報': '競合情報',
      '業界インサイト': '業界インサイト',
      '施策・アクション': '施策・アクション',
      '顧客事例': '顧客事例',
    }

    const newEntries = parsed.entries.map((e: any) => ({
      id: `kb_decomp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      title: `【${e.category}】${sourceTitle}`,
      content: e.content,
      label: labelMap[e.category] || 'その他',
      source: sourceTitle,
      createdAt: now,
    }))

    const updated = [...newEntries, ...existing].slice(0, 200)
    await redis.set(KEY, updated)

    return NextResponse.json({ success: true, added: newEntries.length, categories: newEntries.map((e: any) => e.label) })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
