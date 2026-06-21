import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// 脳の記憶 samurai:brain-feed（キャッチアップくんが投入した新着）を画面用に読み出す。
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })

export async function GET() {
  try {
    const raw = (await redis.get<any[]>('samurai:brain-feed')) || []
    // 既存フィードも掃除：無関係(none)を隠し、ほぼ同内容の重複を1件に
    const seen = new Set<string>()
    const feed = raw
      .filter(f => f && f.verdict !== 'none')
      .filter(f => {
        const k = (f.oneLine || f.title || '').slice(0, 22)
        if (!k || seen.has(k)) return false
        seen.add(k); return true
      })
    const summary = (await redis.get<any>('samurai:brain-catch-summary')) || null
    return NextResponse.json({ feed, summary })
  } catch {
    return NextResponse.json({ feed: [], summary: null })
  }
}
