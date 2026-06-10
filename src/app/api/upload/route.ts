import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

// クライアント直アップロード用のトークン発行エンドポイント
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
        allowedContentTypes: ['video/*'],
        maximumSizeInBytes: 1024 * 1024 * 1024, // 1GB
      }),
      onUploadCompleted: async () => {
        // アップロード完了時のフック（現状は処理なし）
      },
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
