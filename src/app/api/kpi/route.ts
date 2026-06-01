import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KPI_KEY = 'samurai:kpi'

export async function GET() {
  try {
    const kpi = await redis.get(KPI_KEY)
    return NextResponse.json(kpi || {})
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch KPI' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const kpi = await request.json()
    await redis.set(KPI_KEY, kpi)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save KPI' }, { status: 500 })
  }
}
