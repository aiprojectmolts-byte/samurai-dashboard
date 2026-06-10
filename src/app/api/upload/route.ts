import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

// クライアント直アップロード用のトークン発行エンドポイント（動画・HTML 両対応）
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody
    const jsonResponse = await handleUpload({
      request,
      body,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => ({
        access: 'public',
        addRandomSuffix: true,
        maximumSizeInBytes: 1024 * 1024 * 1024, // 1GB（動画・HTML共通）
      }),
      onUploadCompleted: async () => {
        // 完了フック（現状処理なし）。Vercel本番では公開URLにコールバックされる
      },
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
