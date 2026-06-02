import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
const def = { samurai: ['加藤', '髙山', '川島', '横溝', 'その他'], molts: ['海老澤', '本村', 'その他'] }

export async function GET() {
  try { const d = await redis.get<typeof def>('samurai:members'); return NextResponse.json(d || def) }
  catch { return NextResponse.json(def) }
}
export async function POST(req: Request) {
  const body = await req.json()
  await redis.set('samurai:members', body)
  return NextResponse.json({ ok: true })
}
