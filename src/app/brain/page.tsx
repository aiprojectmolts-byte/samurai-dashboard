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

type QA = { q: string; a: string; sources?: string[]; loading?: boolean; error?: string }
type Convo = { id: string; title: string; turns: QA[]; updatedAt: number }

function badgeColor(v: string): string {
  return ({ competitor: '#c0392b', threat: '#d35400', tailwind: '#1e7e34', research: '#6b5bd2', none: '#9a9a9a' } as Record<string, string>)[v] || '#9a9a9a'
}

// モデル出力を安全に整形（HTMLエスケープ→markdown-lite）
function format(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/^### (.+)$/gm, '<div style="font-weight:600;font-size:15px;margin:16px 0 6px">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-weight:600;font-size:16px;margin:18px 0 7px">$1</div>')
    .replace(/^# (.+)$/gm, '<div style="font-weight:600;font-size:13px;margin:8px 0 5px;color:#6b6b6b">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-・*] (.+)$/gm, '<div style="display:flex;gap:8px;margin:5px 0"><span style="color:#bbb;flex-shrink:0">•</span><span style="flex:1">$1</span></div>')
    .replace(/\n{2,}/g, '<div style="height:11px"></div>')
    .replace(/\n/g, '<br/>')
}

function fmtDate(t: number): string {
  try { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` } catch { return '' }
}

export default function BrainPage() {
  const [tab, setTab] = useState<'today' | 'ani' | 'catch' | 'battle'>('today')
  const [input, setInput] = useState('')
  const [convos, setConvos] = useState<Convo[]>([])
  const [currentId, setCurrentId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [showList, setShowList] = useState(false)
  const [feed, setFeed] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [watch, setWatch] = useState<any[]>([])
  const [catching, setCatching] = useState(false)
  const [newCutoff, setNewCutoff] = useState(0)
  const [cards, setCards] = useState<any[]>([])
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [cmdkQuery, setCmdkQuery] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      const list: Convo[] = raw ? JSON.parse(raw) : []
      if (list.length) setConvos(list)
      // リロードしても、最後に開いていた会話をそのまま復活させる
      const savedId = localStorage.getItem('brain_current') || ''
      if (savedId && list.some(c => c.id === savedId)) setCurrentId(savedId)
      // 前回キャッチアップを見たとき以降の「新着」を判定するための基準
      setNewCutoff(Number(localStorage.getItem('brain_catch_lastseen') || 0))
    } catch { /* noop */ }
    loadFeed()
    loadWatch()
    loadCards()
    taRef.current?.focus()
  }, [])

  // Cmd/Ctrl+K でコマンドパレット
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdkOpen(o => !o); setCmdkQuery('') }
      else if (e.key === 'Escape') setCmdkOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // キャッチアップを開いたら「ここまで見た」を記録（次回の"新着"判定に使う）
  useEffect(() => { if (tab === 'catch') { try { localStorage.setItem('brain_catch_lastseen', String(Date.now())) } catch { /* noop */ } } }, [tab])

  // 新しい発言が来たら最新までスクロール
  useEffect(() => { if (tab === 'ani') bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [loading, currentId, tab])

  const loadWatch = async () => {
    try { const r = await fetch('/api/brain-watch'); const d = await r.json(); setWatch(Array.isArray(d.watch) ? d.watch : []) } catch { /* noop */ }
  }
  const loadCards = async () => {
    try { const r = await fetch('/api/brain-battlecards'); const d = await r.json(); setCards(Array.isArray(d.cards) ? d.cards : []) } catch { /* noop */ }
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
    try { const r = await fetch('/api/brain-feed'); const d = await r.json(); setFeed(Array.isArray(d.feed) ? d.feed : []); setSummary(d.summary || null) } catch { /* noop */ }
  }
  const runCatchup = async () => {
    if (catching) return
    setCatching(true)
    try { await fetch('/api/cron/catchup'); await loadFeed() } catch { /* noop */ }
    setCatching(false)
  }

  const isNew = (f: any) => { try { return !!(f?.createdAt && new Date(f.createdAt).getTime() > newCutoff) } catch { return false } }
  const newCount = feed.filter(isNew).length

  // キャッチアップのニュースを兄さんに渡す（読む→動くに繋ぐ）
  const fromFeed = (f: any, mode: 'ask' | 'make') => {
    const head = f.oneLine || f.title || ''
    const link = f.link ? `\n${f.link}` : ''
    setInput(mode === 'make'
      ? `次のニュースを、SAMURAI向けに加藤さんの正直な文体でコンテンツの下書き（フック1行＋骨子）にして：\n「${head}」${link}`
      : `次のニュース、SAMURAIにどう関係する？詳しく教えて：\n「${head}」${link}`)
    setTab('ani')
    setTimeout(() => taRef.current?.focus(), 60)
  }

  // 「今日」タブ用：重要度順 上位3件
  const VPRI: Record<string, number> = { competitor: 0, threat: 1, tailwind: 2, research: 3, none: 9 }
  const today3 = [...feed]
    .sort((a: any, b: any) => ((isNew(b) ? 1 : 0) - (isNew(a) ? 1 : 0)) || ((VPRI[a.verdict] ?? 5) - (VPRI[b.verdict] ?? 5)))
    .slice(0, 3)

  // 兄さんの回答下：フォロー質問＆ワンクリック行動
  const FOLLOWUPS = ['根拠と出典は？', '競合はどう動いてる？', 'うちのLP・コンテンツに落とすと？']
  const copyText = (t: string) => { try { navigator.clipboard?.writeText(t) } catch { /* noop */ } }
  const makeContent = () => ask('今の回答を、SAMURAI向けに加藤さんの正直な文体でコンテンツの下書き（フック1行＋骨子）にして')

  // Cmd-K のコマンド一覧（先頭が Enter で実行される）
  const cmds: { label: string; run: () => void }[] = (() => {
    const q = cmdkQuery.trim()
    const base = [
      { label: '☀️ 今日へ', run: () => { setTab('today'); setCmdkOpen(false) } },
      { label: '🧠 兄さんへ', run: () => { setTab('ani'); setCmdkOpen(false) } },
      { label: '🐣 新着へ', run: () => { setTab('catch'); setCmdkOpen(false) } },
      { label: '⚔️ 競合へ', run: () => { setTab('battle'); setCmdkOpen(false) } },
      { label: '＋ 新しい会話', run: () => { newConvo(); setTab('ani'); setCmdkOpen(false) } },
      { label: '🔄 今すぐ拾う', run: () => { setCmdkOpen(false); runCatchup() } },
    ]
    if (!q) return base
    return [{ label: `「${q}」を兄さんに聞く`, run: () => { setCmdkOpen(false); setTab('ani'); ask(q) } }, ...base.filter(c => c.label.includes(q))]
  })()

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
      updateConvo(id, c => ({ ...c, turns: c.turns.map((t, i) => (i === 0 ? { q, a: data.answer || '', sources: data.sources, error: data.error, loading: false } : t)), updatedAt: Date.now() }))
    } catch (e: any) {
      updateConvo(id, c => ({ ...c, turns: c.turns.map((t, i) => (i === 0 ? { q, a: '', error: String(e), loading: false } : t)) }))
    }
    setLoading(false)
  }

  const tabBtn = (key: 'today' | 'ani' | 'catch' | 'battle', label: string) => (
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
          {tabBtn('today', '☀️ 今日')}
          {tabBtn('ani', '🧠 兄さん')}
          {tabBtn('catch', `🐣 新着${feed.length ? `（${feed.length}）` : ''}`)}
          {tabBtn('battle', '⚔️ 競合')}
        </div>

        {tab === 'today' && (
          <div>
            <div style={{ fontSize: 13, color: '#9a9a9a', marginBottom: 16 }}>{new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}・自社マーケのいま</div>

            {summary?.text && (
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#3f3f3f', marginBottom: 6 }}>⚡ 30秒キャッチアップ</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.75, color: '#1f1f1f' }} dangerouslySetInnerHTML={{ __html: format(summary.text) }} />
              </div>
            )}

            {today3.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#3f3f3f', marginBottom: 8 }}>📍 今日の3つ</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {today3.map((f: any, i: number) => (
                    <div key={f.id || i} style={{ background: '#fff', border: `0.5px solid ${isNew(f) ? 'rgba(192,57,43,0.35)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: badgeColor(f.verdict) }}>{f.badge || ''}</span>
                        {isNew(f) && <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, color: '#fff', background: '#c0392b', borderRadius: 4, padding: '1px 5px' }}>NEW</span>}
                        <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 }}>{f.oneLine || f.title}</span>
                      </div>
                      {f.soWhat && <div style={{ fontSize: 12.5, color: '#444', marginTop: 4, lineHeight: 1.55, borderLeft: '2px solid #e2e0da', paddingLeft: 8 }}>{f.soWhat}</div>}
                      <div style={{ fontSize: 10.5, color: '#a9a9a9', marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        {f.source && <span>{f.source}</span>}
                        {f.link && <a href={f.link} target="_blank" rel="noopener noreferrer" style={{ color: '#7a8cff' }}>元記事</a>}
                        <button onClick={() => fromFeed(f, 'ask')} style={{ fontSize: 10.5, color: '#3f3f3f', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 10, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>🧠 深掘り</button>
                        <button onClick={() => fromFeed(f, 'make')} style={{ fontSize: 10.5, color: '#3f3f3f', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 10, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>✍️ ネタにする</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div onClick={() => setTab('catch')} style={{ fontSize: 12, color: '#7a8cff', cursor: 'pointer', marginTop: 10 }}>→ 全部見る（キャッチアップ）</div>
              </div>
            )}

            {convos.length > 0 ? (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#3f3f3f', marginBottom: 8 }}>▶ 続き</div>
                <div onClick={() => { setCurrentId(convos[0].id); setTab('ani') }}
                  style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '11px 13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{convos[0].title || '無題の会話'}</span>
                  <span style={{ fontSize: 11, color: '#a9a9a9', flexShrink: 0 }}>{fmtDate(convos[0].updatedAt)}・続ける →</span>
                </div>
              </div>
            ) : (
              <div onClick={() => setTab('ani')} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', fontSize: 13, color: '#6b6b6b' }}>
                🧠 兄さんに何でも聞く →
              </div>
            )}
          </div>
        )}

        {tab === 'ani' && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '74vh' }}>
            {/* 会話ツールバー */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <button onClick={newConvo}
                style={{ fontSize: 12, padding: '6px 12px', background: '#0f0f0f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>＋ 新しい会話</button>
              <button onClick={() => setShowList(s => !s)}
                style={{ fontSize: 12, padding: '6px 12px', background: '#fff', color: '#3f3f3f', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                📋 過去の会話{convos.length ? `（${convos.length}）` : ''}
              </button>
            </div>

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

            {/* 会話（時系列・吹き出し） */}
            <div style={{ flex: 1 }}>
              {history.length === 0 ? (
                <div style={{ padding: '6px 0 20px' }}>
                  <div style={{ fontSize: 14, color: '#6b6b6b', lineHeight: 1.75, marginBottom: 16 }}>なんでも知ってる"兄さん"。わからん言葉も、記事も、URLも投げて。サクッとも、じっくりもOK。</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {EXAMPLES.map(ex => (
                      <button key={ex} onClick={() => ask(ex)} disabled={loading}
                        style={{ fontSize: 12.5, padding: '7px 13px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 18, color: '#3f3f3f', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 100 }}>
                  {[...history].reverse().map((qa, i, arr) => {
                    const last = i === arr.length - 1 && !!qa.a && !qa.loading && !qa.error
                    return (
                    <div key={i}>
                      {/* 自分（右の吹き出し） */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <div style={{ maxWidth: '82%', background: '#0f0f0f', color: '#fff', borderRadius: '16px 16px 5px 16px', padding: '10px 15px', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{qa.q}</div>
                      </div>
                      {/* 兄さん（左のクリーンな本文） */}
                      <div style={{ display: 'flex', gap: 11, marginBottom: 8 }}>
                        <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: '#eceae3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🧠</div>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, lineHeight: 1.85, color: '#222', paddingTop: 3 }}>
                          {qa.loading ? <span style={{ color: '#9a9a9a' }}>考えてます…</span>
                            : qa.error ? <span style={{ color: '#c0392b' }}>エラー：{qa.error}</span>
                              : <div dangerouslySetInnerHTML={{ __html: format(qa.a) }} />}
                        </div>
                      </div>
                      <div style={{ marginLeft: 39, marginBottom: 16 }}>
                        {qa.sources && qa.sources.length > 0 && !qa.loading && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: last ? 8 : 0 }}>
                            {qa.sources.map((u: string, j: number) => {
                              let host = u; try { host = new URL(u).hostname.replace(/^www\./, '') } catch { /* noop */ }
                              return (
                                <a key={j} href={u} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#3f3f3f', background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 12, padding: '3px 9px', textDecoration: 'none' }}>
                                  <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" width={13} height={13} style={{ borderRadius: 2 }} />
                                  {host}
                                </a>
                              )
                            })}
                          </div>
                        )}
                        {last && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                            {FOLLOWUPS.map(c => (
                              <button key={c} onClick={() => ask(c)} disabled={loading} style={{ fontSize: 11.5, padding: '5px 11px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.13)', borderRadius: 14, color: '#3f3f3f', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>{c}</button>
                            ))}
                            <button onClick={makeContent} disabled={loading} style={{ fontSize: 11.5, padding: '5px 11px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.13)', borderRadius: 14, color: '#3f3f3f', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>✍️ ネタにする</button>
                            <button onClick={() => copyText(qa.a)} style={{ fontSize: 11.5, padding: '5px 11px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.13)', borderRadius: 14, color: '#3f3f3f', cursor: 'pointer', fontFamily: 'inherit' }}>📋 コピー</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* 入力（下に固定） */}
            <div style={{ position: 'sticky', bottom: 12, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.09)' }}>
              <textarea
                ref={taRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ask() }}
                placeholder="兄さんに聞く… 例：BIMって何？　／　記事やURLを貼る"
                style={{ width: '100%', minHeight: 44, maxHeight: 200, border: 'none', outline: 'none', resize: 'none', fontSize: 14.5, fontFamily: 'inherit', lineHeight: 1.6, background: 'transparent', color: '#0f0f0f', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#bbb' }}>⌘/Ctrl + Enter</span>
                <button onClick={() => ask()} disabled={loading || !input.trim()}
                  style={{ padding: '8px 20px', background: input.trim() && !loading ? '#0f0f0f' : '#e2e0da', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: input.trim() && !loading ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                  {loading ? '…' : '送信'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'catch' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, color: '#6b6b6b', lineHeight: 1.6 }}>業界・競合の新着を拾って、要点に束ねます。</div>
              <button onClick={runCatchup} disabled={catching}
                style={{ flexShrink: 0, fontSize: 12, padding: '6px 12px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 14, color: '#3f3f3f', cursor: catching ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {catching ? '拾ってます…' : '🔄 今すぐ拾う'}
              </button>
            </div>

            {/* ⚡30秒キャッチアップ（要約） */}
            {summary?.text && (
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#3f3f3f', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span>⚡ 30秒キャッチアップ</span>
                  <span style={{ fontWeight: 400, color: '#a9a9a9', fontSize: 10.5 }}>{(summary.updatedAt || '').slice(5, 10)} 更新</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#1f1f1f' }} dangerouslySetInnerHTML={{ __html: format(summary.text) }} />
              </div>
            )}

            {/* 新着ニュース */}
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#3f3f3f', marginBottom: 8, display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span>📰 新着ニュース</span>
              {newCount > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#c0392b' }}>NEW {newCount}件</span>}
            </div>
            {feed.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9a9a9a', padding: '14px 0', lineHeight: 1.6 }}>まだ新着はありません。「今すぐ拾う」で最新ニュースを集めます。</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {feed.map((f, i) => (
                  <div key={f.id || i} style={{ background: '#fff', border: `0.5px solid ${isNew(f) ? 'rgba(192,57,43,0.35)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
                      <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: badgeColor(f.verdict) }}>{f.badge || ''}</span>
                      {isNew(f) && <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, color: '#fff', background: '#c0392b', borderRadius: 4, padding: '1px 5px' }}>NEW</span>}
                      <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 }}>{f.oneLine || f.title}</span>
                    </div>
                    {f.soWhat && <div style={{ fontSize: 12.5, color: '#5a5a5a', marginTop: 3, lineHeight: 1.5 }}>→ {f.soWhat}</div>}
                    <div style={{ fontSize: 10.5, color: '#a9a9a9', marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {f.source && <span>{f.source}</span>}
                      {f.link && <a href={f.link} target="_blank" rel="noopener noreferrer" style={{ color: '#7a8cff' }}>元記事</a>}
                      <button onClick={() => fromFeed(f, 'ask')} style={{ fontSize: 10.5, color: '#3f3f3f', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 10, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>🧠 兄さんに聞く</button>
                      <button onClick={() => fromFeed(f, 'make')} style={{ fontSize: 10.5, color: '#3f3f3f', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 10, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>✍️ ネタにする</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ウォッチ中（参考・下に置く） */}
            {watch.length > 0 && (
              <div style={{ marginTop: 24 }}>
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
                <div style={{ fontSize: 11, color: '#a9a9a9', marginTop: 8, lineHeight: 1.5 }}>※ 日々の投稿は上のリンクから手動フォロー（X等は自動取得できないため）。</div>
              </div>
            )}
          </>
        )}

        {tab === 'battle' && (
          <div>
            <div style={{ fontSize: 12.5, color: '#6b6b6b', marginBottom: 14, lineHeight: 1.6 }}>主要競合の30秒バトルカード。商談前にその1枚を見る。反論対応は、まず相手の強みを正直に認めてから旋回。</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cards.map((b: any, i: number) => (
                <div key={i} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '13px 15px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{b.name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#c0392b' }}>脅威 {b.threat}</span>
                    <span style={{ fontSize: 10.5, color: '#9a9a9a' }}>{b.axis}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#444', marginTop: 6, lineHeight: 1.6 }}>{b.overview}</div>

                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1e7e34', marginTop: 10, marginBottom: 4 }}>🎯 我々の勝ち筋</div>
                  {b.winPlays?.map((w: string, j: number) => (
                    <div key={j} style={{ fontSize: 12.5, color: '#1f1f1f', lineHeight: 1.55, display: 'flex', gap: 6, marginBottom: 2 }}><span style={{ color: '#bbb' }}>•</span><span>{w}</span></div>
                  ))}

                  <div style={{ fontSize: 11.5, color: '#6b6b6b', marginTop: 10 }}><b style={{ fontWeight: 600 }}>💰 価格</b>　{b.price}</div>

                  {b.objection && (
                    <div style={{ marginTop: 10, background: '#f7f7f5', borderRadius: 8, padding: '9px 11px' }}>
                      <div style={{ fontSize: 12, color: '#6b6b6b', fontStyle: 'italic' }}>💬 {b.objection.says}</div>
                      <div style={{ fontSize: 12.5, color: '#1f1f1f', marginTop: 4, lineHeight: 1.6 }}>{b.objection.reply}</div>
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: '#c0392b', marginTop: 10, lineHeight: 1.55, display: 'flex', gap: 6 }}><span style={{ flexShrink: 0 }}>🚫</span><span><b style={{ fontWeight: 600 }}>言ってはいけない：</b>{b.landmine}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cmdkOpen && (
          <div onClick={() => setCmdkOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh', zIndex: 50 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 'min(540px, 92vw)', background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              <input autoFocus value={cmdkQuery} onChange={e => setCmdkQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') cmds[0]?.run() }}
                placeholder="コマンド or 質問…（兄さんに聞く / タブ移動 / 今すぐ拾う）"
                style={{ width: '100%', padding: '14px 16px', border: 'none', borderBottom: '0.5px solid rgba(0,0,0,0.1)', outline: 'none', fontSize: 14.5, fontFamily: "'Inter','Noto Sans JP',sans-serif", boxSizing: 'border-box' }} />
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {cmds.map((c, i) => (
                  <div key={i} onClick={c.run} style={{ padding: '11px 16px', fontSize: 13.5, cursor: 'pointer', background: i === 0 ? '#f4f4f2' : '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.04)', fontFamily: "'Inter','Noto Sans JP',sans-serif" }}>{c.label}</div>
                ))}
              </div>
              <div style={{ padding: '8px 16px', fontSize: 10.5, color: '#a9a9a9', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>Enter で先頭を実行 ・ Esc で閉じる</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
