import { Redis } from '@upstash/redis'
import { notFound } from 'next/navigation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

interface Material {
  id: string
  title: string
  slug?: string
  type: string
}

export default async function GijirokuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const materials = (await redis.get('samurai:materials')) as Material[] | null
  const material = (Array.isArray(materials) ? materials : []).find(m => m?.slug === slug)
  if (!material) notFound()

  const html = await redis.get<string>(`samurai:material-content:${material.id}`)
  if (html == null) notFound()
  const content = String(html)

  // 完全なHTMLドキュメントなので <style> と <body> 内側を取り出し、
  // body セレクタをラッパークラスに置換してレイアウト（flex等）を維持したまま埋め込む
  const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const css = (styleMatch ? styleMatch[1] : '').replace(/\bbody\s*{/g, '.gijiroku-doc {')
  const bodyInner = bodyMatch ? bodyMatch[1] : content

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div className="gijiroku-doc" dangerouslySetInnerHTML={{ __html: bodyInner }} />
    </>
  )
}
