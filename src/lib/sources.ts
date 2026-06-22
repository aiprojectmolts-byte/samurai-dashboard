// 自社プロダクト（Rendery / knock knock 3D / knock knock AI / VISIOAL / 受託）の
// 直接・価値競合とその周辺トレンドを定点観測するためのキーワード群と取得ロジック。
// /api/trends（画面用）と /api/cron/research（自走バッチ）が共有する。

export const TREND_KEYWORDS = [
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

export interface TrendNewsItem { title: string; link: string; pubDate: string; source: string }
export interface TrendGroup { keyword: string; items: TrendNewsItem[]; error?: string }

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function fetchKeywordNews(keyword: string, n = 3, withinDays = 14): Promise<TrendGroup> {
  // when:Nd で「直近N日」に限定。Google News は既定だと関連度順で、古いセミナー告知などが混ざるため。
  const q = encodeURIComponent(`${keyword} when:${withinDays}d`)
  const url = `https://news.google.com/rss/search?q=${q}&hl=ja&gl=JP&ceid=JP:ja`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
    })
    if (!res.ok) return { keyword, items: [], error: `HTTP ${res.status}` }
    const xml = await res.text()
    const cutoff = Date.now() - withinDays * 86400000
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map(m => {
        const item = m[1]
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
        return {
          title: item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
                 item.match(/<title>(.*?)<\/title>/)?.[1] || '',
          link: item.match(/<link>(.*?)<\/link>/)?.[1] || '',
          pubDate,
          source: item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || '',
          _ts: Date.parse(pubDate) || 0,
        }
      })
      // 古い記事を弾く（日付不明は when: で既に絞り込み済として残す）→ 新しい順 → 上位n件
      .filter(i => i.title && (i._ts === 0 || i._ts >= cutoff))
      .sort((a, b) => b._ts - a._ts)
      .slice(0, n)
      .map(({ _ts, ...rest }) => rest)
    return { keyword, items }
  } catch (e) {
    return { keyword, items: [], error: String(e) }
  }
}

// Google News の中継URL（news.google.com/.../articles/CBMi...）を実記事URLに復元する。
// これを挟まないと、中継ページ(JSアプリ)が返るだけで記事本文が取得できない（＝兄さんが「読めない」になる）。
// 仕組み: 記事ページから署名(data-n-a-sg)と時刻(data-n-a-ts)を取り、Googleの batchexecute で実URLに復号する。
export async function resolveGoogleNewsUrl(url: string): Promise<string> {
  try {
    if (!url || !url.includes('news.google.') || !url.includes('/articles/')) return url
    const gid = url.match(/\/articles\/([^?/]+)/)?.[1]
    if (!gid) return url
    const page = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(8000) })
    const html = await page.text()
    const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1]
    const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1]
    if (!ts || !sg) return url
    const inner = JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], gid, Number(ts), sg])
    const freq = JSON.stringify([[['Fbv4je', inner, null, '1']]])
    const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': UA },
      body: new URLSearchParams({ 'f.req': freq }).toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const raw = await res.text()
    const m = raw.match(/garturlres[\\",\s]*?(https?:\/\/[^"\\\s]+)/) || raw.match(/https?:\/\/(?!news\.google|www\.google)[^"\\\s]+/)
    return m ? (m[1] || m[0]) : url
  } catch {
    return url
  }
}

export async function fetchTrendsGrouped(n = 3): Promise<TrendGroup[]> {
  return Promise.all(TREND_KEYWORDS.map(k => fetchKeywordNews(k, n)))
}

export async function fetchTrendItemsFlat(n = 3): Promise<(TrendNewsItem & { keyword: string })[]> {
  const groups = await fetchTrendsGrouped(n)
  return groups.flatMap(g => g.items.filter(i => i.title).map(i => ({ ...i, keyword: g.keyword })))
}
