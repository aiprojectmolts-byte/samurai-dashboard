import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:plan-decisions'

// 加藤の企画採否（出したい/直したい/却下）。"自分の名前で出したい率"を上げる学習信号。
export async function GET() {
  try {
    const data = await redis.get(KEY)
    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const entry = { ...body, createdAt: new Date().toISOString() }
    const existing: any[] = (await redis.get(KEY) as any[]) || []
    // 同じ企画(planKey)への再判定は上書き
    const filtered = entry.planKey ? existing.filter(e => e.planKey !== entry.planKey) : existing
    const updated = [entry, ...filtered].slice(0, 300)
    await redis.set(KEY, updated)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
