import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:researcher-brief'

// リサーチャー担当者の「判断の土台」。全AI生成に注入され、反応から育てていく。
export async function GET() {
  try {
    const data = await redis.get(KEY)
    return NextResponse.json(data || { brief: '', updatedAt: '' })
  } catch {
    return NextResponse.json({ brief: '', updatedAt: '' })
  }
}

export async function POST(request: Request) {
  try {
    const { brief } = await request.json()
    const entry = { brief: String(brief || ''), updatedAt: new Date().toISOString() }
    await redis.set(KEY, entry)
    return NextResponse.json({ success: true, updatedAt: entry.updatedAt })
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
