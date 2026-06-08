import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:categories'
const TASKS_KEY = 'samurai:tasks'

interface Category { id: string; name: string }

// 保存済みカテゴリを返す。未保存なら現在のタスクの施策ユニーク値から導出（永続化はしない）
async function getCategories(): Promise<Category[]> {
  const stored = (await redis.get(KEY)) as Category[] | null
  if (stored && Array.isArray(stored)) return stored
  const tasks = ((await redis.get(TASKS_KEY)) as any[]) || []
  const seen: string[] = []
  for (const t of tasks) {
    const s = t?.施策
    if (s && !seen.includes(s)) seen.push(s)
  }
  return seen.map(s => ({ id: s, name: s }))
}

export async function GET() {
  try {
    return NextResponse.json(await getCategories())
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json()
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    const categories = await getCategories()
    const entry: Category = { id: Date.now().toString(), name: String(name).trim() }
    const updated = [...categories, entry]
    await redis.set(KEY, updated)
    return NextResponse.json({ success: true, category: entry })
  } catch {
    return NextResponse.json({ error: 'Failed to add' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, name } = await request.json()
    const newName = String(name || '').trim()
    if (!id || !newName) {
      return NextResponse.json({ error: 'id and name required' }, { status: 400 })
    }
    const categories = await getCategories()
    const target = categories.find(c => c.id === id)
    if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const oldName = target.name

    const updated = categories.map(c => c.id === id ? { ...c, name: newName } : c)
    await redis.set(KEY, updated)

    // 旧名を参照しているタスクの施策を新名へ一括更新
    if (oldName !== newName) {
      const tasks = ((await redis.get(TASKS_KEY)) as any[]) || []
      const newTasks = tasks.map(t => t?.施策 === oldName ? { ...t, 施策: newName } : t)
      await redis.set(TASKS_KEY, newTasks)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const categories = await getCategories()
    const target = categories.find(c => c.id === id)
    const updated = categories.filter(c => c.id !== id)
    await redis.set(KEY, updated)

    // 削除カテゴリを参照しているタスクの施策を「未分類」に変更
    if (target) {
      const tasks = ((await redis.get(TASKS_KEY)) as any[]) || []
      const newTasks = tasks.map(t => t?.施策 === target.name ? { ...t, 施策: '未分類' } : t)
      await redis.set(TASKS_KEY, newTasks)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
