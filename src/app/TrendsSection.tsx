'use client'
import { useState, useEffect } from 'react'

const DEFAULT_KEYWORDS = ['建築 AI', '建設 DX', '建築 デジタル', '工務店 AI', '設計 自動化', 'BIM AI']

export default function TrendsSection() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [keywords, setKeywords] = useState<string[]>(DEFAULT_KEYWORDS)
  const [newKeyword, setNewKeyword] = useState('')
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  const fetchTrends = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/trends')
      const data = await res.json()
      setResults(data.results || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTrends() }, [])

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()])
      setNewKeyword('')
    }
  }

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter(k => k !== kw))
  }

  const saveToKnowledge = async (item: any, keyword: string) => {
    const key = item.link
    try {
      await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          content: `【トレンドニュース: ${keyword}】\n${item.title}\n${item.link}\n${item.pubDate}`,
          label: 'トレンド',
          source: item.source,
        })
      })
      setSaved(prev => ({ ...prev, [key]: true }))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>業界トレンドニュース</div>
        <button onClick={fetchTrends} disabled={loading} style={{ fontSize: 10, padding: '3px 10px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          {loading ? '取得中...' : '🔄 更新'}
        </button>
      </div>

      {/* キーワード管理 */}
      <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>検索キーワード</div>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 }}>
          {keywords.map(kw => (
            <span key={kw} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>
              {kw}
              <button onClick={() => removeKeyword(kw)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 10, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            placeholder="キーワードを追加..." style={{ flex: 1, padding: '4px 8px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 11, fontFamily: 'inherit' }} />
          <button onClick={addKeyword} style={{ padding: '4px 10px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>追加</button>
        </div>
      </div>

      {/* ニュース一覧 */}
      {loading ? (
        <div style={{ padding: 20, color: 'var(--muted)', fontSize: 12, textAlign: 'center' as const }}>取得中...</div>
      ) : (
        results.map((r, i) => (
          <div key={i} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)', marginBottom: 8 }}>🔍 {r.keyword}</div>
            {r.items?.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>ニュースが見つかりませんでした</div>
            ) : (
              r.items?.map((item: any, j: number) => (
                <div key={j} style={{ borderTop: j > 0 ? '0.5px solid var(--b1)' : 'none', paddingTop: j > 0 ? 8 : 0, marginTop: j > 0 ? 8 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <a href={item.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', lineHeight: 1.5 }}>{item.title}</a>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{item.source} · {item.pubDate?.slice(0, 16)}</div>
                    </div>
                    <button onClick={() => saveToKnowledge(item, r.keyword)}
                      disabled={saved[item.link]}
                      style={{ flexShrink: 0, fontSize: 10, padding: '3px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: saved[item.link] ? 'var(--gbg)' : 'none', color: saved[item.link] ? 'var(--green)' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>
                      {saved[item.link] ? '✓ 保存済' : '📚 ナレッジ'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ))
      )}
    </div>
  )
}
