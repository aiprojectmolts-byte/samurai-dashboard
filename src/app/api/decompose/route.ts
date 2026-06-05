import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:knowledge'

const PROMPTS: Record<string, string> = {
  mtg: `以下のMTG・逐語録を読んで、各カテゴリに該当する箇所を抽出してください。
該当なしの場合はそのカテゴリを出力しないでください。発言はできるだけ原文のまま引用してください。

カテゴリ定義：
・加藤CEOペルソナ：加藤CEOが思想・比喩・ビジョンを語っている発言
・商談ログ：顧客・見込み客の課題・反応
・競合情報：競合他社への言及
・業界インサイト：業界全体の動向・数字
・施策・アクション：今後の打ち手・決定事項
・顧客事例：具体的な導入事例・成果

JSONのみ返してください：{"entries":[{"category":"カテゴリ名","content":"抽出内容（markdown形式）"}]}`,

  document: `以下の資料・スライドを読んで、各カテゴリに該当する内容を抽出してください。
該当なしの場合はそのカテゴリを出力しないでください。

カテゴリ定義：
・自社背景：自社プロダクト・サービス・実績・強みに関する情報
・競合情報：競合他社・競合サービスの情報・比較
・業界インサイト：業界全体の動向・市場データ・数字
・顧客事例：具体的な導入事例・成果・活用シーン

JSONのみ返してください：{"entries":[{"category":"カテゴリ名","content":"抽出内容（markdown形式）"}]}`,

  news: `以下の記事・ニュースを読んで、各カテゴリに該当する内容を抽出してください。
該当なしの場合はそのカテゴリを出力しないでください。

カテゴリ定義：
・業界インサイト：業界動向・トレンド・数字
・競合情報：競合他社・競合サービスに関する情報

JSONのみ返してください：{"entries":[{"category":"カテゴリ名","content":"抽出内容（markdown形式）"}]}`
}

const LABEL_MAP: Record<string, string> = {
  '加藤CEOペルソナ': '加藤CEOペルソナ',
  '商談ログ': '商談ログ',
  '競合情報': '競合情報',
  '業界インサイト': '業界インサイト',
  '施策・アクション': '施策・アクション',
  '顧客事例': '顧客事例',
  '自社背景': '自社背景',
}

export async function POST(request: Request) {
  try {
    const { text, sourceTitle, sourceType = 'mtg' } = await request.json()
    const systemPrompt = PROMPTS[sourceType] || PROMPTS.mtg

    const CHUNK_SIZE = 40000
    const chunks: string[] = []
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.slice(i, i + CHUNK_SIZE))
    }

    const allEntries: any[] = []

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci]
      const prompt = `${systemPrompt}\n\nソース（${ci + 1}/${chunks.length}）：\n${chunk}`

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
          messages: [{ role: 'user', content: prompt }]
        })
      })

      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      try {
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
        allEntries.push(...(parsed.entries || []))
      } catch {
        console.error(`Chunk ${ci + 1} parse error`)
      }
    }

    // 同じカテゴリをマージ
    const merged: Record<string, string> = {}
    for (const e of allEntries) {
      if (merged[e.category]) {
        merged[e.category] += '\n\n' + e.content
      } else {
        merged[e.category] = e.content
      }
    }

    const now = new Date().toLocaleDateString('ja-JP')
    const newEntries = Object.entries(merged).map(([category, content]) => ({
      id: `kb_decomp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: `【${category}】${sourceTitle}`,
      content,
      label: LABEL_MAP[category] || 'その他',
      source: sourceTitle,
      createdAt: now,
    }))

    const existing: any[] = (await redis.get(KEY) as any[]) || []
    const updated = [...newEntries, ...existing].slice(0, 200)
    await redis.set(KEY, updated)

    return NextResponse.json({
      success: true,
      added: newEntries.length,
      chunks: chunks.length,
      categories: newEntries.map((e: any) => e.label)
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
