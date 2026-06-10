import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  console.log('[upload] POST received')
  console.log('[upload] BLOB_READ_WRITE_TOKEN exists:',
    !!process.env.BLOB_READ_WRITE_TOKEN)

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
    console.log('[upload] body type:', (body as any)?.type)
  } catch (e) {
    console.error('[upload] body parse error:', e)
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        console.log('[upload] generating token for:', pathname)
        return {
          allowedContentTypes: ['video/mp4', 'video/webm',
            'video/quicktime', 'video/*'],
          maximumSizeInBytes: 1024 * 1024 * 1024,
        }
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[upload] completed:', blob.url)
      },
    })
    console.log('[upload] handleUpload success')
    return Response.json(jsonResponse)
  } catch (error) {
    console.error('[upload] handleUpload error:', error)
    return Response.json(
      { error: (error as Error).message, stack: (error as Error).stack },
      { status: 400 }
    )
  }
}
