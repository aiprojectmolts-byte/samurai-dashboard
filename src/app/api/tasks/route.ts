import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const TASKS_KEY = 'samurai:tasks'

export async function GET() {
  try {
    const tasks = await redis.get(TASKS_KEY)
    // マイグレーション: id 未設定のタスクにユニークな id を付与して保存し直す（初回のみ）
    if (Array.isArray(tasks)) {
      let changed = false
      const migrated = tasks.map((t: any) => {
        if (t && !t.id) {
          changed = true
          return { ...t, id: Date.now().toString() + Math.random().toString(36).slice(2) }
        }
        return t
      })
      if (changed) await redis.set(TASKS_KEY, migrated)
      return NextResponse.json(migrated)
    }
    return NextResponse.json(tasks || [])
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const tasks = await request.json()
    await redis.set(TASKS_KEY, tasks)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save tasks' }, { status: 500 })
  }
}
