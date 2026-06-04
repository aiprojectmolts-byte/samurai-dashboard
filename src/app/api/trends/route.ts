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
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      cache: 'no-store'
    })
    if (!res.ok) return { keyword, items: [], error: `HTTP ${res.status}` }
    const xml = await res.text()
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 3).map(m => {
      const item = m[1]
      return {
        title: item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || 
               item.match(/<title>(.*?)<\/title>/)?.[1] || '',
        link: item.match(/<link>(.*?)<\/link>/)?.[1] || '',
        pubDate: item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '',
        source: item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || '',
      }
    })
    return { keyword, items }
  } catch (e) {
    return { keyword, items: [], error: String(e) }
  }
}

export async function GET() {
  const results = await Promise.all(KEYWORDS.map(fetchNewsForKeyword))
  return NextResponse.json({ results })
}
