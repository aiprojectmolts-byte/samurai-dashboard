import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })

const USERS_KEY = 'samurai:slack-users'

// user ID を表示名に解決する。キャッシュ優先・Slack API で補完。
async function resolveUserName(userId: string): Promise<string> {
  if (!userId) return userId
  const token = process.env.SLACK_BOT_TOKEN
  // キャッシュ確認
  const cache = (await redis.get<Record<string, string>>(USERS_KEY)) || {}
  if (cache[userId]) return cache[userId]
  // トークン未設定なら ID のまま返す（解決不可）
  if (!token) return userId
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!data.ok || !data.user) return userId
    const p = data.user.profile || {}
    const name = p.display_name || p.real_name || data.user.real_name || data.user.name || userId
    // キャッシュ保存
    cache[userId] = name
    await redis.set(USERS_KEY, cache)
    return name
  } catch {
    return userId
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge })
  }

  if (body.event?.type === 'message' && !body.event.bot_id) {
    const displayName = await resolveUserName(body.event.user)
    const msg = {
      id: body.event.ts,
      channel: body.event.channel,
      user: displayName,
      text: body.event.text,
      ts: body.event.ts,
      createdAt: new Date().toISOString(),
    }
    const existing = await redis.get<object[]>('samurai:slack-logs') || []
    await redis.set('samurai:slack-logs', [msg, ...existing].slice(0, 500))
  }

  return NextResponse.json({ ok: true })
}
