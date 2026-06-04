import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://trends.google.com/trending/rss?geo=JP', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 }
    })
    const xml = await res.text()

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
      const item = m[1]
      const title = item.match(/<title>(.*?)<\/title>/)?.[1] || ''
      const traffic = item.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/)?.[1] || ''
      const newsItems = [...item.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)].map(n => {
        const news = n[1]
        return {
          title: news.match(/<ht:news_item_title>(.*?)<\/ht:news_item_title>/)?.[1] || '',
          url: news.match(/<ht:news_item_url>(.*?)<\/ht:news_item_url>/)?.[1] || '',
          source: news.match(/<ht:news_item_source>(.*?)<\/ht:news_item_source>/)?.[1] || '',
        }
      })
      return { title, traffic, newsItems }
    })

    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
