import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// 脳の記憶 samurai:brain-feed（キャッチアップくんが投入した新着）を画面用に読み出す。
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })

export async function GET() {
  try {
    const feed = (await redis.get<any[]>('samurai:brain-feed')) || []
    return NextResponse.json({ feed })
  } catch {
    return NextResponse.json({ feed: [] })
  }
}
