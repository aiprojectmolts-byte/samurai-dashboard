import { NextResponse } from 'next/server'

const KEYWORDS = [
  '建築 AI',
  '建設 DX',
  '建築 デジタル',
  '工務店 AI',
  '設計 自動化',
  'BIM AI',
]

async function fetchNewsForKeyword(keyword: string) {
  const q = encodeURIComponent(keyword)
  const url = `https://news.google.com/rss/search?q=${q}&hl=ja&gl=JP&ceid=JP:ja`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  const xml = await res.text()
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 3).map(m => {
    const item = m[1]
    return {
      title: item.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '') || '',
      link: item.match(/<link>(.*?)<\/link>/)?.[1] || '',
      pubDate: item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '',
      source: item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || '',
    }
  })
  return { keyword, items }
}

export async function GET() {
  try {
    const results = await Promise.all(KEYWORDS.map(fetchNewsForKeyword))
    return NextResponse.json({ results })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
