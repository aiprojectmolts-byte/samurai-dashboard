'use client'
// SAMURAI脳（独立ページ /brain）。兄さん(チャット)とキャッチアップ(新着)をタブで分離。
// 会話はブラウザ内(localStorage)に保存し、過去の会話から復活できる。
import { useState, useRef, useEffect } from 'react'

const EXAMPLES = [
  'BIMって何？',
  'taziku ってどんな競合？',
  '2024年問題は自社にどう関係する？',
  '不動産DXって何？',
]
const LS_KEY = 'brain_convos'

type QA = { q: string; a: string; loading?: boolean; error?: string }
type Convo = { id: string; title: string; turns: QA[]; updatedAt: number }

function badgeColor(v: string): string {
  return ({ competitor: '#c0392b', threat: '#d35400', tailwind: '#1e7e34', research: '#6b5bd2', none: '#9a9a9a' } as Record<string, string>)[v] || '#9a9a9a'
}

// モデル出力を安全に整形（HTMLエスケープ→markdown-lite）
function format(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/^### (.+)$/gm, '<div style="font-weight:600;font-size:14px;margin:12px 0 4px">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-weight:600;font-size:15px;margin:14px 0 5px">$1</div>')
    .replace(/^# (.+)$/gm, '<div style="font-weight:600;font-size:12px;margin:6px 0 4px;color:#6b6b6b">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-・*] (.+)$/gm, '<div style="display:flex;gap:6px;margin:3px 0"><span style="color:#9a9a9a">•</span><span>$1</span></div>')
    .replace(/\n/g, '<br/>')
}

function fmtDate(t: number): string {
  try { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` } catch { return '' }
}

export default function BrainPage() {
  const [tab, setTab] = useState<'ani' | 'catch'>('ani')
  const [input, setInput] = useState('')
  const [convos, setConvos] = useState<Convo[]>([])
  const [currentId, setCurrentId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [showList, setShowList] = useState(false)
  const [feed, setFeed] = useState<any[]>([])
  const [watch, setWatch] = useState<any[]>([])
  const [brief, setBrief] = useState<any>(null)
  const [catching, setCatching] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      const list: Convo[] = raw ? JSON.parse(raw) : []
      if (list.length) setConvos(list)
      // リロードしても、最後に開いていた会話をそのまま復活させる
      const savedId = localStorage.getItem('brain_current') || ''
      if (savedId && list.some(c => c.id === savedId)) setCurrentId(savedId)
    } catch { /* noop */ }
    loadFeed()
    loadWatch()
    loadBrief()
    taRef.current?.focus()
  }, [])

  const loadWatch = async () => {
    try { const r = await fetch('/api/brain-watch'); const d = await r.json(); setWatch(Array.isArray(d.watch) ? d.watch : []) } catch { /* noop */ }
  }
  const loadBrief = async () => {
    try { const r = await fetch('/api/brain-brief'); const d = await r.json(); setBrief(d.brief || null) } catch { /* noop */ }
  }

  // 開いている会話を記憶（ハードリロードで消えないように）
  useEffect(() => { try { localStorage.setItem('brain_current', currentId) } catch { /* noop */ } }, [currentId])

  const save = (list: Convo[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 50))) } catch { /* noop */ }
  }
  const updateConvo = (id: string, updater: (c: Convo) => Convo) => {
    setConvos(prev => { const next = prev.map(c => (c.id === id ? updater(c) : c)); save(next); return next })
  }

  const current = convos.find(c => c.id === currentId) || null
  const history = current ? current.turns : []

  const loadFeed = async () => {
    try { const r = await fetch('/api/brain-feed'); const d = await r.json(); setFeed(Array.isArray(d.feed) ? d.feed : []) } catch { /* noop */ }
  }
  const runCatchup = async () => {
    if (catching) return
    setCatching(true)
    try { await fetch('/api/cron/catchup'); await loadFeed() } catch { /* noop */ }
    setCatching(false)
  }

  const newConvo = () => { setCurrentId(''); setShowList(false); setInput(''); taRef.current?.focus() }

  const ask = async (text?: string) => {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setLoading(true); setInput('')

    let id = currentId
    const priorTurns: QA[] = id ? (convos.find(c => c.id === id)?.turns || []) : []
    const msgs = [...priorTurns].filter(t => !t.loading && !t.error && t.a).reverse()
      .flatMap(t => [{ role: 'user', content: t.q }, { role: 'assistant', content: t.a }])
    msgs.push({ role: 'user', content: q })

    if (!id) {
      id = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
      const convo: Convo = { id, title: q.slice(0, 28), turns: [{ q, a: '', loading: true }], updatedAt: Date.now() }
      setCurrentId(id)
      setConvos(prev => { const next = [convo, ...prev]; save(next); return next })
    } else {
      updateConvo(id, c => ({ ...c, turns: [{ q, a: '', loading: true }, ...c.turns], updatedAt: Date.now() }))
    }

    try {
      const res = await fetch('/api/brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs }) })
      const data = await res.json()
      updateConvo(id, c => ({ ...c, turns: c.turns.map((t, i) => (i === 0 ? { q, a: data.answer || '', error: data.error, loading: false } : t)), updatedAt: Date.now() }))
    } catch (e: any) {
      updateConvo(id, c => ({ ...c, turns: c.turns.map((t, i) => (i === 0 ? { q, a: '', error: String(e), loading: false } : t)) }))
    }
    setLoading(false)
  }

  const tabBtn = (key: 'ani' | 'catch', label: string) => (
    <button onClick={() => setTab(key)}
      style={{ flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', border: 'none', borderBottom: tab === key ? '2px solid #0f0f0f' : '2px solid transparent', background: 'none', color: tab === key ? '#0f0f0f' : '#9a9a9a' }}>
      {label}
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f2', color: '#0f0f0f', fontFamily: "'Inter','Noto Sans JP',sans-serif", padding: '24px 18px 80px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 12 }}>🧠 SAMURAI脳</div>

        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(0,0,0,0.1)', marginBottom: 16 }}>
          {tabBtn('ani', '🧠 兄さん')}
          {tabBtn('catch', `🐣 キャッチアップ${feed.length ? `（${feed.length}）` : ''}`)}
        </div>

        {tab === 'ani' && (
          <>
            {brief?.focus && (
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#3f3f3f', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span>📌 今、知っておくこと</span>
                  <span style={{ fontWeight: 400, color: '#a9a9a9', fontSize: 10.5 }}>{(brief.updatedAt || '').slice(0, 10)} 更新</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#1f1f1f' }} dangerouslySetInnerHTML={{ __html: format(brief.focus) }} />
              </div>
            )}
            <div style={{ fontSize: 12.5, color: '#6b6b6b', marginBottom: 12, lineHeight: 1.6 }}>
              なんでも知ってる"兄さん"。わからん言葉も記事もURLも投げて。サクッとも、じっくりもOK。
            </div>

            {/* 会話ツールバー */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <button onClick={newConvo}
                style={{ fontSize: 12, padding: '6px 12px', background: '#0f0f0f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>＋ 新しい会話</button>
              <button onClick={() => setShowList(s => !s)}
                style={{ fontSize: 12, padding: '6px 12px', background: '#fff', color: '#3f3f3f', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                📋 過去の会話{convos.length ? `（${convos.length}）` : ''}
              </button>
            </div>

            {/* 過去の会話リスト */}
            {showList && (
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
                {convos.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9a9a9a', padding: '12px 14px' }}>まだ保存された会話はありません。</div>
                ) : convos.map(c => (
                  <div key={c.id} onClick={() => { setCurrentId(c.id); setShowList(false) }}
                    style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, background: c.id === currentId ? '#f4f4f2' : '#fff' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title || '無題の会話'}</span>
                    <span style={{ fontSize: 11, color: '#a9a9a9', flexShrink: 0 }}>{fmtDate(c.updatedAt)}・{c.turns.length}往復</span>
                  </div>
                ))}
              </div>
            )}

            {/* 入力 */}
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <textarea
                ref={taRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ask() }}
                placeholder="わからん言葉、記事、URL…なんでも。&#10;例：BIMって何？　／　〔記事やURLを貼る〕"
                style={{ width: '100%', minHeight: 80, border: 'none', outline: 'none', resize: 'vertical', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, background: 'transparent', color: '#0f0f0f', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#9a9a9a' }}>⌘/Ctrl + Enter で送信</span>
                <button onClick={() => ask()} disabled={loading || !input.trim()}
                  style={{ padding: '8px 22px', background: input.trim() && !loading ? '#0f0f0f' : '#d4d4d2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: input.trim() && !loading ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                  {loading ? '考え中…' : '聞く'}
                </button>
              </div>
            </div>

            {/* 例（会話が空のとき） */}
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

            {/* 会話 */}
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {history.map((qa, i) => (
                <div key={i}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'flex', gap: 8 }}>
                    <span style={{ color: '#9a9a9a', flexShrink: 0 }}>Q</span>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{qa.q.length > 200 ? qa.q.slice(0, 200) + '…' : qa.q}</span>
                  </div>
                  <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '14px 16px', fontSize: 14, lineHeight: 1.75, color: '#1f1f1f' }}>
                    {qa.loading ? <span style={{ color: '#9a9a9a' }}>🧠 ポケットを探ってます…</span>
                      : qa.error ? <span style={{ color: '#c0392b' }}>エラー：{qa.error}</span>
                        : <div dangerouslySetInnerHTML={{ __html: format(qa.a) }} />}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'catch' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, color: '#6b6b6b', lineHeight: 1.6 }}>毎朝、業界・競合の新着を拾って 🔴競合 / ⚠️脅威 / 🟢追い風 / 🎓研究 に仕分け。</div>
              <button onClick={runCatchup} disabled={catching}
                style={{ flexShrink: 0, fontSize: 12, padding: '6px 12px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 14, color: '#3f3f3f', cursor: catching ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {catching ? '拾ってます…' : '🔄 今すぐ拾う'}
              </button>
            </div>
            {watch.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#3f3f3f', marginBottom: 8 }}>👤 ウォッチ中（業界を動かす人・メディア／検証済み）</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {watch.map((w, i) => (
                    <div key={i} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '9px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{w.name}</div>
                      <div style={{ fontSize: 11.5, color: '#6b6b6b', marginTop: 2, lineHeight: 1.45 }}>{w.role}</div>
                      <div style={{ fontSize: 11.5, color: '#5a5a5a', marginTop: 3, lineHeight: 1.45 }}>→ {w.why}</div>
                      {Array.isArray(w.links) && w.links.length > 0 && (
                        <div style={{ marginTop: 5, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {w.links.map((l: any, j: number) => (
                            <a key={j} href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#7a8cff' }}>{l.label} ↗</a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#a9a9a9', marginTop: 8, lineHeight: 1.5 }}>※ 日々の投稿は上のリンクから手動フォロー（X等は自動取得できないため）。ニュースでの言及は下の新着に自動で出ます。</div>
              </div>
            )}

            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#3f3f3f', marginBottom: 8 }}>📰 新着ニュース</div>
            {feed.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9a9a9a', padding: '14px 0', lineHeight: 1.6 }}>まだ新着はありません。「今すぐ拾う」で最新ニュースを集めます。</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {feed.map((f, i) => (
                  <div key={f.id || i} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
                      <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: badgeColor(f.verdict) }}>{f.badge || ''}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 }}>{f.oneLine || f.title}</span>
                    </div>
                    {f.soWhat && <div style={{ fontSize: 12.5, color: '#5a5a5a', marginTop: 3, lineHeight: 1.5 }}>→ {f.soWhat}</div>}
                    <div style={{ fontSize: 10.5, color: '#a9a9a9', marginTop: 5, display: 'flex', gap: 8 }}>
                      {f.source && <span>{f.source}</span>}
                      {f.link && <a href={f.link} target="_blank" rel="noopener noreferrer" style={{ color: '#7a8cff' }}>元記事</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
