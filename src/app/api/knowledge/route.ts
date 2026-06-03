import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:knowledge'

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
    const entry = await request.json()
    const existing: any[] = (await redis.get(KEY) as any[]) || []
    const updated = [entry, ...existing].slice(0, 200)
    await redis.set(KEY, updated)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    const existing: any[] = (await redis.get(KEY) as any[]) || []
    const updated = existing.filter((e: any) => e.id !== id)
    await redis.set(KEY, updated)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const updated = await request.json()
    const existing: any[] = (await redis.get(KEY) as any[]) || []
    const newList = existing.map((e: any) => e.id === updated.id ? { ...e, ...updated } : e)
    await redis.set(KEY, newList)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
