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
    const msg = String(error)
    if (msg.includes('Transcript is disabled')) {
      return NextResponse.json({ error: 'この動画は字幕が無効です。テキスト貼り付けモードをお使いください。' }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
