'use client'
// SAMURAI脳（四次元ポケット）の独立ページ。/brain で開く。ダッシュボードとは独立。
// 分からん言葉・記事・Slackの一覧を投げると、SAMURAI文脈で平易に＋「自社への意味」付きで返す。
import { useState, useRef, useEffect } from 'react'

const EXAMPLES = [
  'BIMって何？',
  'taziku ってどんな競合？',
  '2024年問題は自社にどう関係する？',
  '不動産DXって何？',
]

type QA = { q: string; a: string; loading?: boolean; error?: string }

function badgeColor(v: string): string {
  return ({ competitor: '#c0392b', threat: '#d35400', tailwind: '#1e7e34', research: '#6b5bd2', none: '#9a9a9a' } as Record<string, string>)[v] || '#9a9a9a'
}

// モデル出力を安全に整形（HTMLエスケープ→markdown-lite）
function format(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/^### (.+)$/gm, '<div style="font-weight:600;font-size:14px;margin:12px 0 4px">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-weight:600;font-size:15px;margin:14px 0 5px">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-・*] (.+)$/gm, '<div style="display:flex;gap:6px;margin:3px 0"><span style="color:#9a9a9a">•</span><span>$1</span></div>')
    .replace(/\n/g, '<br/>')
}

export default function BrainPage() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<QA[]>([])
  const [loading, setLoading] = useState(false)
  const [feed, setFeed] = useState<any[]>([])
  const [catching, setCatching] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { taRef.current?.focus(); loadFeed() }, [])

  const loadFeed = async () => {
    try {
      const r = await fetch('/api/brain-feed')
      const d = await r.json()
      setFeed(Array.isArray(d.feed) ? d.feed : [])
    } catch { /* feedは任意 */ }
  }

  const runCatchup = async () => {
    if (catching) return
    setCatching(true)
    try { await fetch('/api/cron/catchup'); await loadFeed() } catch { /* noop */ }
    setCatching(false)
  }

  const ask = async (text?: string) => {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setLoading(true)
    setInput('')
    // これまでの完了した往復を兄さんに渡す（会話の記憶）
    const prior = history.filter(h => !h.loading && !h.error && h.a)
    const msgs = [...prior].reverse().flatMap(h => [
      { role: 'user', content: h.q },
      { role: 'assistant', content: h.a },
    ])
    msgs.push({ role: 'user', content: q })
    setHistory(prev => [{ q, a: '', loading: true }, ...prev])
    try {
      const res = await fetch('/api/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })
      const data = await res.json()
      setHistory(prev => prev.map((item, i) =>
        i === 0 ? { q, a: data.answer || '', error: data.error, loading: false } : item))
    } catch (e: any) {
      setHistory(prev => prev.map((item, i) =>
        i === 0 ? { q, a: '', error: String(e), loading: false } : item))
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f2', color: '#0f0f0f', fontFamily: "'Inter','Noto Sans JP',sans-serif", padding: '28px 18px 80px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* ヘッダー */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>🧠 SAMURAI脳</div>
          <div style={{ fontSize: 13, color: '#6b6b6b', marginTop: 4, lineHeight: 1.6 }}>
            なんでも知ってる"兄さん"が、わからん言葉も記事も、たとえ話でほぐして「自社にどう効くか」まで教えてくれる。<br />
            サクッと聞いても、じっくり分かるまで付き合ってもOK。
          </div>
        </div>

        {/* 入力 */}
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <textarea
            ref={taRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ask() }}
            placeholder="わからん言葉、貼りたい記事、Slackのニュース一覧…なんでも。&#10;例：BIMって何？　／　〔ニュースをまるごと貼る〕"
            style={{ width: '100%', minHeight: 90, border: 'none', outline: 'none', resize: 'vertical', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, background: 'transparent', color: '#0f0f0f', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#9a9a9a' }}>⌘/Ctrl + Enter で送信</span>
            <button
              onClick={() => ask()}
              disabled={loading || !input.trim()}
              style={{ padding: '8px 22px', background: input.trim() && !loading ? '#0f0f0f' : '#d4d4d2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: input.trim() && !loading ? 'pointer' : 'default', fontFamily: 'inherit' }}
            >{loading ? '考え中…' : '聞く'}</button>
          </div>
        </div>

        {/* 🐣 キャッチアップくん */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#3f3f3f' }}>🐣 今日のキャッチアップ{feed.length ? `（${feed.length}）` : ''}</div>
            <button onClick={runCatchup} disabled={catching}
              style={{ fontSize: 11, padding: '5px 12px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 14, color: '#3f3f3f', cursor: catching ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {catching ? '拾ってます…' : '🔄 今すぐ拾う'}
            </button>
          </div>
          {feed.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9a9a9a', padding: '8px 0', lineHeight: 1.6 }}>
              まだ新着はありません。「今すぐ拾う」で最新の業界・競合ニュースを集めて、🔴競合 / ⚠️脅威 / 🟢追い風 / 🎓研究 に仕分けします。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {feed.slice(0, 12).map((f, i) => (
                <div key={f.id || i} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '9px 11px' }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: badgeColor(f.verdict) }}>{f.badge || ''}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>{f.oneLine || f.title}</span>
                  </div>
                  {f.soWhat && <div style={{ fontSize: 12, color: '#5a5a5a', marginTop: 3, lineHeight: 1.5 }}>→ {f.soWhat}</div>}
                  <div style={{ fontSize: 10, color: '#a9a9a9', marginTop: 5, display: 'flex', gap: 8 }}>
                    {f.source && <span>{f.source}</span>}
                    {f.link && <a href={f.link} target="_blank" rel="noopener noreferrer" style={{ color: '#7a8cff' }}>元記事</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 例 */}
        {history.length === 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => ask(ex)} disabled={loading}
                style={{ fontSize: 12, padding: '6px 12px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 16, color: '#3f3f3f', cursor: 'pointer', fontFamily: 'inherit' }}>
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* 履歴 */}
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {history.map((qa, i) => (
            <div key={i}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'flex', gap: 8 }}>
                <span style={{ color: '#9a9a9a', flexShrink: 0 }}>Q</span>
                <span style={{ whiteSpace: 'pre-wrap' }}>{qa.q.length > 200 ? qa.q.slice(0, 200) + '…' : qa.q}</span>
              </div>
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '14px 16px', fontSize: 14, lineHeight: 1.75, color: '#1f1f1f' }}>
                {qa.loading ? (
                  <span style={{ color: '#9a9a9a' }}>🧠 ポケットを探ってます…</span>
                ) : qa.error ? (
                  <span style={{ color: '#c0392b' }}>エラー：{qa.error}</span>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: format(qa.a) }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
