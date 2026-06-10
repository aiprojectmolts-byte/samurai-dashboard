import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Redis に保存したHTML本文を text/html で直接返す
    const stored = await redis.get<string>(`samurai:material-content:${id}`)
    if (stored != null) {
      return new NextResponse(String(stored), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // 後方互換：旧データ（Blob保存のhtmlUrl）はプロキシ取得して返す
    const materials = (await redis.get('samurai:materials')) as any[] | null
    const m = (Array.isArray(materials) ? materials : []).find((x: any) => x.id === id)
    if (m?.htmlUrl) {
      try {
        const r = await fetch(m.htmlUrl, { cache: 'no-store' })
        if (r.ok) {
          return new NextResponse(await r.text(), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }
      } catch {}
      return NextResponse.redirect(m.htmlUrl)
    }

    return new NextResponse('資料が見つかりませんでした', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    return new NextResponse('エラー: ' + String(error), {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
