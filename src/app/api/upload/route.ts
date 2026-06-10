import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['video/mp4', 'video/webm', 'video/mov',
          'video/m4v', 'video/quicktime', 'video/*'],
        maximumSizeInBytes: 1024 * 1024 * 1024, // 1GB
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('Upload completed:', blob.url)
      },
    })
    return Response.json(jsonResponse)
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
