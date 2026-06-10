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

// 単一の質問のステータス等を更新。回答済みになったら、linkedQuestionId が一致するタスクを done にする
export async function PATCH(req: Request) {
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const questions = (await redis.get<any[]>('samurai:questions')) || []
    const list = Array.isArray(questions) ? questions : []
    const target = list.find(q => q?.id === id)
    if (!target) return NextResponse.json({ error: 'question not found' }, { status: 404 })

    const updated = list.map(q => (q?.id === id ? { ...q, ...updates } : q))
    await redis.set('samurai:questions', updated)

    // 「回答済み（answered / 回答済み）」になったら紐づくタスクを done に
    const newStatus = updates.status ?? target.status
    const isAnswered = newStatus === 'answered' || newStatus === '回答済み'
    let updatedTasks = 0
    if (isAnswered) {
      const tasks = (await redis.get<any[]>('samurai:tasks')) || []
      const tlist = Array.isArray(tasks) ? tasks : []
      let changed = false
      const next = tlist.map(t => {
        if (t?.linkedQuestionId === id && t.st !== 'done') {
          changed = true
          updatedTasks++
          return { ...t, st: 'done' }
        }
        return t
      })
      if (changed) await redis.set('samurai:tasks', next)
    }

    return NextResponse.json({ ok: true, updatedTasks })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
