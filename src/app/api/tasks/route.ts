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

// マージで保護するフィールドはこの4つのみ。これら以外はクライアントの値をそのまま使う。
const PROTECTED_FIELDS = ['背景', '背景ソース', 'label', 'linkedQuestionId']

function mergeTask(existing: any, incoming: any) {
  if (!existing) return incoming // 新規タスク（既存IDなし）はそのまま追加
  // name・st・assignee・日付・施策・phase 等はクライアントの編集内容をそのまま採用
  const out: any = { ...incoming }
  // 保護フィールドのみ、クライアントが未送信/空のときに既存値で補完（外部更新の巻き戻し防止）
  for (const f of PROTECTED_FIELDS) {
    const v = incoming[f]
    if (v === undefined || v === null || v === '') {
      if (existing[f] !== undefined) out[f] = existing[f]
    }
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
