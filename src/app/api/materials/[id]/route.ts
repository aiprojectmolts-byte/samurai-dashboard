import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const materials = (await redis.get('samurai:materials')) as any[] | null
    const m = (Array.isArray(materials) ? materials : []).find((x: any) => x.id === id)

    // 新方式：Blob上のHTMLにリダイレクト
    if (m?.htmlUrl) return NextResponse.redirect(m.htmlUrl)

    // 後方互換：旧データ（Redis保存HTML）はそのまま返す
    const html = await redis.get<string>(`samurai:material-content:${id}`)
    if (html != null) {
      return new NextResponse(String(html), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
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
