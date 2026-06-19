import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { enforceSingleApproved, type ArticleSuggestion } from '../../components/articleSuggestions'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// 提案は記事ごとにキーを分ける。merge-save もその記事内だけで完結する。
const keyFor = (articleId: string) => `samurai:article-suggestions:${articleId}`

export async function GET(request: Request) {
  try {
    const articleId = new URL(request.url).searchParams.get('articleId')
    if (!articleId) return NextResponse.json([])
    const data = await redis.get(keyFor(articleId))
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const articleId: string = body?.articleId
    const incoming: ArticleSuggestion[] = Array.isArray(body?.suggestions) ? body.suggestions : []
    if (!articleId) return NextResponse.json({ error: 'articleId required' }, { status: 400 })

    // 既存提案を id でインデックス化（/api/tasks の merge-save と同方式）
    const existing = await redis.get(keyFor(articleId))
    const existingById = new Map<string, ArticleSuggestion>()
    if (Array.isArray(existing)) for (const s of existing as ArticleSuggestion[]) if (s?.id) existingById.set(s.id, s)

    // 提案の本体（original/proposed/proposer 等）は作成後不変。既存があれば判断系フィールドのみ上書き。
    // クライアントが送らなかった既存提案は削除扱い（送信配列がソース・オブ・トゥルース）。
    const merged: ArticleSuggestion[] = incoming.map(s => {
      const prev = s?.id ? existingById.get(s.id) : undefined
      if (!prev) return s // 新規提案はそのまま採用
      return {
        ...prev,
        status: s.status ?? prev.status,
        approver: s.approver ?? prev.approver,
        note: s.note ?? prev.note,
        decidedAt: s.decidedAt ?? prev.decidedAt,
      }
    })

    // 1ブロック＝承認済み最大1件を保証（同時承認が来ても最新だけ残す）
    const enforced = enforceSingleApproved(merged)
    await redis.set(keyFor(articleId), enforced)
    return NextResponse.json(enforced)
  } catch {
    return NextResponse.json({ error: 'Failed to save suggestions' }, { status: 500 })
  }
}
