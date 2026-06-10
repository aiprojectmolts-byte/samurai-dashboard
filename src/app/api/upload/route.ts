import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

// 大きな動画ファイルを受け取れるよう、デフォルトのbodyサイズ制限・静的化を解除する
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const blob = await put(file.name || `upload-${Date.now()}`, file, {
      access: 'public',
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return NextResponse.json({ url: blob.url })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
