import { NextResponse } from 'next/server'

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    if (file.name.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      return NextResponse.json({ text: data.text })
    } else {
      // md/txt はそのままテキストとして返す
      return NextResponse.json({ text: buffer.toString('utf-8') })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
