import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:content-plans'

export async function GET() {
  try {
    const plans = await redis.get(KEY)
    return NextResponse.json(plans || [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const newPlan = await request.json()
    const existing: any[] = (await redis.get(KEY) as any[]) || []
    const updated = [newPlan, ...existing].slice(0, 50) // 最大50件
    await redis.set(KEY, updated)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
