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
    expressions.forEach((e: any) => {
      const date = e.createdAt?.slice(0, 10) || ''
      const theme = e.theme || ''
      ;(e.ng || []).forEach((ng: string) => items.push({ expression: ng, category: 'NG', theme, date }))
      ;(e.ok || []).forEach((ok: string) => items.push({ expression: ok, category: 'OK', theme, date }))
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
