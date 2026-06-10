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

// クライアントが省略/null で送っても既存値を守るフィールド（空文字での消去も防ぐ）
const PROTECTED_FIELDS = ['背景', '背景ソース', 'label', 'linkedQuestionId']

function mergeTask(existing: any, incoming: any) {
  if (!existing) return incoming // 新規タスク（既存IDなし）はそのまま追加
  const out: any = { ...existing }
  for (const [k, v] of Object.entries(incoming)) {
    // クライアントが undefined / null で送ったフィールドは既存値を保持
    if (v === undefined || v === null) continue
    // 保護フィールドは空文字での上書き（消去）も防ぐ
    if (PROTECTED_FIELDS.includes(k) && v === '') continue
    out[k] = v
  }
  return out
}

export async function POST(request: Request) {
  try {
    const incoming = await request.json()
    if (!Array.isArray(incoming)) {
      // 配列でない場合は従来通りそのまま保存（後方互換）
      await redis.set(TASKS_KEY, incoming)
      return NextResponse.json({ success: true })
    }

    // 既存データを id でインデックス化
    const existing = await redis.get(TASKS_KEY)
    const existingById = new Map<string, any>()
    if (Array.isArray(existing)) {
      for (const t of existing) if (t && t.id) existingById.set(t.id, t)
    }

    // クライアントが送ってきた配列をベースにマージ（送られないIDは削除＝現行動作を維持）
    const merged = incoming.map((t: any) => {
      const prev = t && t.id ? existingById.get(t.id) : undefined
      return mergeTask(prev, t)
    })

    await redis.set(TASKS_KEY, merged)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save tasks' }, { status: 500 })
  }
}
