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
  blobUrl?: string
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
    const form = await request.formData()
    const title = String(form.get('title') || '')
    const date = String(form.get('date') || '')
    const type = String(form.get('type') || '') as Material['type']
    if (!title || !date || !type) {
      return NextResponse.json({ error: 'title, date, type are required' }, { status: 400 })
    }

    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    const entry: Material = { id, title, date, type, createdAt: new Date().toISOString() }

    if (type === 'html') {
      const htmlFile = form.get('htmlFile') as File | null
      if (!htmlFile) return NextResponse.json({ error: 'htmlFile required' }, { status: 400 })
      let html = await htmlFile.text()
      const blobUrl = String(form.get('blobUrl') || '')
      if (blobUrl) {
        // ../assets/xxx.mp4 等のローカル動画srcを Blob URL に置換
        html = html.replace(
          /((?:src|href)\s*=\s*)(["'])[^"']*\.(?:mp4|webm|mov|m4v|ogg)\2/gi,
          `$1$2${blobUrl}$2`
        )
        entry.blobUrl = blobUrl
      }
      await redis.set(contentKeyFor(id), html)
    } else {
      entry.url = String(form.get('url') || '')
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
    const updated = existing.filter((m: any) => m.id !== id)
    await redis.set(KEY, updated)
    await redis.del(contentKeyFor(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
