import { NextResponse } from 'next/server'

// SAMURAIの自社プロダクト（Rendery / knock knock 3D / knock knock AI / VISIOAL / 受託）の
// 直接・価値競合とその周辺トレンドを定点観測するためのキーワード群。
const KEYWORDS = [
  // 競合・価値競合（CG/建築パース/3Dビジュアライゼーション）
  '建築 パース AI',
  '3D パース 建築',
  '建築 ビジュアライゼーション',
  'レンダリング 建築 AI',
  '内装 デザイン AI',
  // 業界トレンド・DX
  '建築 AI',
  '建設 DX',
  '施工管理 AI',
  'BIM AI',
  'リフォーム DX',
  '不動産 テック',
  // 設計・受託・プロップテック
  '設計 自動化',
  'プロップテック',
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
