import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:briefing'

// 「30秒キャッチアップ」要約。担当者が生成し、従業員も同じものを読める。
export async function GET() {
  try {
    const data = await redis.get(KEY)
    return NextResponse.json(data || { summary: '', generatedAt: '', count: 0 })
  } catch {
    return NextResponse.json({ summary: '', generatedAt: '', count: 0 })
  }
}

export async function POST(request: Request) {
  try {
    const { summary, count } = await request.json()
    const entry = { summary: String(summary || ''), count: Number(count) || 0, generatedAt: new Date().toISOString() }
    await redis.set(KEY, entry)
    return NextResponse.json({ success: true, generatedAt: entry.generatedAt })
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
