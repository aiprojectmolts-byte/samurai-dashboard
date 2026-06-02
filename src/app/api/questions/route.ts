import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })

export async function GET() {
  try { const d = await redis.get<object[]>('samurai:questions'); return NextResponse.json(d || []) }
  catch { return NextResponse.json([]) }
}
export async function POST(req: Request) {
  const body = await req.json()
  await redis.set('samurai:questions', body)
  return NextResponse.json({ ok: true })
}
