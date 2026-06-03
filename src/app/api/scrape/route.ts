import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' }
    })
    const html = await res.text()
    // HTMLタグを除去してテキストのみ抽出
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000)
    return NextResponse.json({ text })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
