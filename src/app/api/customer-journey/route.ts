import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:customer-journey'

// 読者の土台（事実版）。企画骨子生成に注入される。空なら既定値（DEFAULT_CUSTOMER_JOURNEY）を使う。
export async function GET() {
  try {
    const data = await redis.get(KEY)
    return NextResponse.json(data || { journey: '', updatedAt: '' })
  } catch {
    return NextResponse.json({ journey: '', updatedAt: '' })
  }
}

export async function POST(request: Request) {
  try {
    const { journey } = await request.json()
    const entry = { journey: String(journey || ''), updatedAt: new Date().toISOString() }
    await redis.set(KEY, entry)
    return NextResponse.json({ success: true, updatedAt: entry.updatedAt })
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
