import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function POST() {
  try {
    const gasUrl = process.env.GAS_WEBHOOK_URL
    if (!gasUrl) return NextResponse.json({ error: 'GAS_WEBHOOK_URL not set' }, { status: 500 })

    const expressions: any[] = (await redis.get('samurai:content-expressions') as any[]) || []

    const items: any[] = []
    // 今日の日付のエントリのみ同期
    const today = new Date().toLocaleDateString('ja-JP')
    const latestSession = expressions.filter((e: any) => e.date === today)
    // 今日のデータがなければ最新3件
    const targetSession = latestSession.length > 0 ? latestSession : expressions.slice(0, 3)
    targetSession.forEach((e: any) => {
      const date = e.date || e.createdAt?.slice(0, 10) || ''
      const theme = e.theme || ''
      const target = e.target || ''
      const direction = e.direction || ''
      if (e.items?.length > 0) {
        e.items.forEach((item: any) => items.push({
          expression: item.expression,
          judgment: item.judgment || item.type || '',
          theme: item.theme || theme,
          target: item.target || target,
          reason: item.reason || '',
          direction: item.direction || direction,
          date: item.date || date
        }))
      }
    })

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })
    const data = await res.json()
    return NextResponse.json({ success: true, synced: items.length, result: data })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
