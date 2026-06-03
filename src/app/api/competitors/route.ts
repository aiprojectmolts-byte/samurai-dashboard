import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:competitors'

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

    // 同じ競合名が既にあればマージ
    const normalize = (s: string) => s.toLowerCase().replace(/\s/g, '')
    const matchIndex = existing.findIndex((e: any) =>
      normalize(e.competitorName) === normalize(entry.competitorName)
    )

    if (matchIndex >= 0) {
      // マージ：additionalInfoに追記
      const merged = { ...existing[matchIndex] }
      merged.additionalInfo = merged.additionalInfo || []
      merged.additionalInfo.push({
        date: new Date().toLocaleDateString('ja-JP'),
        source: entry.source || '',
        sourceType: entry.sourceType || '',
        summary: entry.summary || '',
        rawText: entry.rawText || '',
        features: entry.features || [],
        weaknesses: entry.weaknesses || [],
      })
      // 主要フィールドも更新（空でなければ）
      if (entry.summary && !merged.summary) merged.summary = entry.summary
      if (entry.features?.length > 0 && merged.features?.length === 0) merged.features = entry.features
      if (entry.weaknesses?.length > 0 && merged.weaknesses?.length === 0) merged.weaknesses = entry.weaknesses
      existing[matchIndex] = merged
      await redis.set(KEY, existing)
      return NextResponse.json({ success: true, merged: true })
    }

    // 新規登録
    const updated = [entry, ...existing].slice(0, 200)
    await redis.set(KEY, updated)
    return NextResponse.json({ success: true, merged: false })
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
