import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:content-writings'

export async function GET() {
  try {
    const data = await redis.get(KEY)
    // マイグレーション: 各 result に安定IDを後付け（提案モードのアンカー先）。既存フィールドは一切変更しない。
    if (Array.isArray(data)) {
      let changed = false
      const migrated = data.map((entry: any) => {
        if (entry && Array.isArray(entry.results)) {
          const results = entry.results.map((res: any, i: number) => {
            if (res && !res.articleId) {
              changed = true
              return { ...res, articleId: `art_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 8)}` }
            }
            return res
          })
          return { ...entry, results }
        }
        return entry
      })
      if (changed) await redis.set(KEY, migrated)
      return NextResponse.json(migrated)
    }
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
