import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:content-expressions'

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
    const newEntry = await request.json()
    const existing: any[] = (await redis.get(KEY) as any[]) || []
    const updated = [newEntry, ...existing].slice(0, 100)
    await redis.set(KEY, updated)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await redis.del(KEY)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to clear' }, { status: 500 })
  }
}
