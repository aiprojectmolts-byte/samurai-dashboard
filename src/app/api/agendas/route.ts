import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:agendas'

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
    const { title, content, date, source } = await request.json()
    const entry = { id: Date.now(), title, content, date, source, confirmedAt: new Date().toISOString() }
    const existing: any[] = (await redis.get(KEY) as any[]) || []
    const updated = [entry, ...existing].slice(0, 50)
    await redis.set(KEY, updated)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
