import { NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()
    const videoId = url.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1]
    if (!videoId) return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
    const transcript = await YoutubeTranscript.fetchTranscript(videoId)
    const text = (transcript as any[]).map(s => s.text).join(' ')
    return NextResponse.json({ text, videoId })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
