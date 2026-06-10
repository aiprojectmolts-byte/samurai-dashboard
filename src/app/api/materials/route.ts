import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:materials'
const contentKeyFor = (id: string) => `samurai:material-content:${id}`

interface Material {
  id: string
  title: string
  date: string
  type: 'html' | 'video' | 'link'
  url?: string
  contentKey?: string
  createdAt: string
}

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
    const { title, date, type, url, htmlContent } = await request.json()
    if (!title || !date || !type) {
      return NextResponse.json({ error: 'title, date, type are required' }, { status: 400 })
    }
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    const entry: Material = {
      id,
      title: String(title),
      date: String(date),
      type,
      createdAt: new Date().toISOString(),
    }
    if (type === 'html') {
      await redis.set(contentKeyFor(id), htmlContent || '')
      entry.contentKey = contentKeyFor(id)
    } else {
      entry.url = url || ''
    }
    const existing: any[] = (await redis.get(KEY) as any[]) || []
    await redis.set(KEY, [entry, ...existing].slice(0, 200))
    return NextResponse.json({ success: true, material: entry })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const existing: any[] = (await redis.get(KEY) as any[]) || []
    const target = existing.find((m: any) => m.id === id)
    const updated = existing.filter((m: any) => m.id !== id)
    await redis.set(KEY, updated)
    if (target?.contentKey) await redis.del(target.contentKey)
    else await redis.del(contentKeyFor(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
