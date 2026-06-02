import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge })
  }

  if (body.event?.type === 'message' && !body.event.bot_id) {
    const msg = {
      id: body.event.ts,
      channel: body.event.channel,
      user: body.event.user,
      text: body.event.text,
      ts: body.event.ts,
      createdAt: new Date().toISOString(),
    }
    const existing = await redis.get<object[]>('samurai:slack-logs') || []
    await redis.set('samurai:slack-logs', [msg, ...existing].slice(0, 500))
  }

  return NextResponse.json({ ok: true })
}
