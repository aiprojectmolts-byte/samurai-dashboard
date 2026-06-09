import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const KEY = 'samurai:phases'

interface Phase { id: string; name: string; order: number }

const DEFAULT_PHASES: Phase[] = [
  { id: 'phase-1', name: 'PHASE 1｜基盤整備', order: 1 },
  { id: 'phase-2', name: 'PHASE 2｜実行', order: 2 },
  { id: 'phase-3', name: 'PHASE 3｜計測・評価', order: 3 },
]

// 保存済みフェーズを返す。未保存なら初期データ（永続化はしない）
async function getPhases(): Promise<Phase[]> {
  const stored = (await redis.get(KEY)) as Phase[] | null
  if (stored && Array.isArray(stored)) return stored
  return DEFAULT_PHASES
}

export async function GET() {
  try {
    return NextResponse.json(await getPhases())
  } catch {
    return NextResponse.json(DEFAULT_PHASES)
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json()
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    const phases = await getPhases()
    const maxOrder = phases.reduce((m, p) => Math.max(m, p.order || 0), 0)
    const entry: Phase = { id: Date.now().toString(), name: String(name).trim(), order: maxOrder + 1 }
    await redis.set(KEY, [...phases, entry])
    return NextResponse.json({ success: true, phase: entry })
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
    const phases = await getPhases()
    if (!phases.some(p => p.id === id)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    await redis.set(KEY, phases.map(p => p.id === id ? { ...p, name: newName } : p))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const phases = await getPhases()
    await redis.set(KEY, phases.filter(p => p.id !== id))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
