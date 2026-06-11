'use client'
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'

const CATEGORIES = ['競合動向', '業界トレンド', '顧客・市場', '技術・プロダクト', '自社への示唆']
const OUR_PRODUCTS = ['Rendery', 'knock knock AI', 'VISIOAL', 'カスタムソリューション']

const catColor: Record<string, string> = {
  '競合動向': '#dc2626', '業界トレンド': '#2563eb', '顧客・市場': '#7c3aed',
  '技術・プロダクト': '#0891b2', '自社への示唆': '#16a34a',
}

interface Insight {
  id: string
  title: string
  category: string
  summary: string
  points: string[]
  relevance: string
  products: string[]
  soWhat: string
  actions: string[]
  sourceType: string
  sourceRef: string
  status: 'draft' | 'published'
  reactions: { helpful: number; learned: number }
  author: string
  createdAt: string
  publishedAt?: string
}

type FormState = Omit<Insight, 'id' | 'createdAt' | 'reactions'>

const emptyForm = (): FormState => ({
  title: '', category: '競合動向', summary: '', points: [], relevance: '',
  products: [], soWhat: '', actions: [], sourceType: 'manual', sourceRef: '',
  status: 'published', author: '', publishedAt: '',
})

export default function Researcher() {
  const [items, setItems] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // フィルター
  const [filterCat, setFilterCat] = useState<Set<string>>(new Set())
  const [filterProduct, setFilterProduct] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // AIアシスト
  const [aiSource, setAiSource] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [taskedAction, setTaskedAction] = useState<string>('')

  const load = async () => {
    try {
      const res = await fetch('/api/insights')
      const data = await res.json()
      if (Array.isArray(data)) setItems(data)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggleSet = (setter: (u: (s: Set<string>) => Set<string>) => void, val: string) =>
    setter(s => { const n = new Set(s); if (n.has(val)) n.delete(val); else n.add(val); return n })

  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))
  const toggleProduct = (p: string) => setForm(f => ({ ...f, products: f.products.includes(p) ? f.products.filter(x => x !== p) : [...f.products, p] }))

  const openNew = () => { setEditId(null); setForm(emptyForm()); setAiSource(''); setError(''); setShowForm(true) }
  const openEdit = (it: Insight) => {
    setEditId(it.id)
    setForm({
      title: it.title, category: it.category, summary: it.summary, points: it.points || [],
      relevance: it.relevance, products: it.products || [], soWhat: it.soWhat, actions: it.actions || [],
      sourceType: it.sourceType, sourceRef: it.sourceRef, status: it.status, author: it.author, publishedAt: it.publishedAt || '',
    })
    setAiSource(''); setError(''); setShowForm(true)
  }

  // AIで骨子生成：貼り付けた情報源 + 自社プロダクト文脈から Claude が草案化
  const runAi = async () => {
    if (!aiSource.trim()) { setError('情報源テキスト（記事・ニュース・ナレッジ等）を貼り付けてください'); return }
    setAiLoading(true); setError('')
    try {
      const system = `あなたはSAMURAI ARCHITECTSのリサーチャーです。SAMURAIは建築・建設業界向けに次のプロダクトを展開しています：${OUR_PRODUCTS.join('、')}。
あなたのミッションは、外部情報を「分析」するだけでなく、従業員が読んで学び・気づき・実行できる『インサイト』に変換して届けることです。
与えられた情報源を読み、以下のJSONのみを返してください（前後の説明・コードブロック記号なし）：
{
  "title": "一目で要点が分かる見出し",
  "category": "${CATEGORIES.join('|')} のいずれか",
  "summary": "要点を2〜3文で",
  "points": ["キーポイントを3〜5個の箇条書きで"],
  "relevance": "この情報がSAMURAIの事業・プロダクトとどう関わるかを具体的に1〜2文で",
  "products": ["関連が深い自社プロダクト名（${OUR_PRODUCTS.join('|')} から該当するものを0〜複数）"],
  "soWhat": "従業員にとっての学び・気づき（So What）を1〜2文で",
  "actions": ["従業員が取れる具体的な推奨アクションを1〜3個"]
}
【ルール】情報源に無い事実・数字は創作しない。憶測が必要な場合はその旨を含めて控えめに書く。`
      const res = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2000, system, messages: [{ role: 'user', content: aiSource.slice(0, 16000) }] }),
      })
      const data = await res.json()
      const raw = data.content?.find((c: any) => c.type === 'text')?.text || ''
      const p = JSON.parse(raw.replace(/```json|```/g, '').trim())
      setForm(f => ({
        ...f,
        title: p.title || f.title,
        category: CATEGORIES.includes(p.category) ? p.category : f.category,
        summary: p.summary || '',
        points: Array.isArray(p.points) ? p.points : [],
        relevance: p.relevance || '',
        products: Array.isArray(p.products) ? p.products.filter((x: string) => OUR_PRODUCTS.includes(x)) : [],
        soWhat: p.soWhat || '',
        actions: Array.isArray(p.actions) ? p.actions : [],
        sourceType: 'paste',
      }))
    } catch (e) {
      console.error('[researcher ai] error:', e)
      setError('AI生成に失敗しました：' + String(e))
    }
    setAiLoading(false)
  }

  const save = async () => {
    if (!form.title.trim() || !form.summary.trim()) { setError('タイトルと要点は必須です'); return }
    setSaving(true); setError('')
    try {
      if (editId) {
        const patch = { id: editId, ...form }
        await fetch('/api/insights', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      } else {
        const entry: Insight = {
          id: 'ins_' + Date.now().toString() + Math.random().toString(36).slice(2, 7),
          ...form,
          reactions: { helpful: 0, learned: 0 },
          createdAt: new Date().toISOString(),
          publishedAt: form.status === 'published' ? new Date().toISOString().slice(0, 10) : '',
        }
        await fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      }
      setShowForm(false)
      await load()
    } catch (e) {
      setError('保存に失敗しました：' + String(e))
    }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!window.confirm('このインサイトを削除しますか？')) return
    await fetch('/api/insights', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  const react = async (it: Insight, kind: 'helpful' | 'learned') => {
    const reactions = { helpful: it.reactions?.helpful || 0, learned: it.reactions?.learned || 0 }
    reactions[kind] += 1
    setItems(list => list.map(x => x.id === it.id ? { ...x, reactions } : x)) // 楽観更新
    await fetch('/api/insights', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, reactions }) })
  }

  const togglePublish = async (it: Insight) => {
    const status = it.status === 'published' ? 'draft' : 'published'
    const publishedAt = status === 'published' && !it.publishedAt ? new Date().toISOString().slice(0, 10) : it.publishedAt
    setItems(list => list.map(x => x.id === it.id ? { ...x, status, publishedAt } : x))
    await fetch('/api/insights', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, status, publishedAt }) })
  }

  // 推奨アクションをタスク化（既存の /api/tasks へ追加）
  const toTask = async (it: Insight, action: string) => {
    try {
      const r = await fetch('/api/tasks')
      const tasks = await r.json()
      const list = Array.isArray(tasks) ? tasks : []
      const newTask = {
        id: 'task_' + Date.now().toString() + Math.random().toString(36).slice(2, 7),
        施策: 'リサーチ', name: action, s: '', e: '', own: 'both', st: 'todo', chg: false,
        assignee: '', src: 'researcher',
        背景: `リサーチ・インサイト「${it.title}」より。${it.soWhat || it.relevance}`,
        背景ソース: 'リサーチャー',
      }
      await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([...list, newTask]) })
      setTaskedAction(it.id + '::' + action)
      setTimeout(() => setTaskedAction(''), 2500)
    } catch (e) {
      setError('タスク化に失敗しました：' + String(e))
    }
  }

  // 統計
  const published = items.filter(i => i.status === 'published')
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const newThisWeek = items.filter(i => i.createdAt >= weekAgo).length
  const totalHelpful = items.reduce((s, i) => s + (i.reactions?.helpful || 0), 0)
  const totalLearned = items.reduce((s, i) => s + (i.reactions?.learned || 0), 0)

  // フィルター適用
  const filtered = items
    .filter(i => filterStatus === 'all' || i.status === filterStatus)
    .filter(i => filterCat.size === 0 || filterCat.has(i.category))
    .filter(i => filterProduct.size === 0 || (i.products || []).some(p => filterProduct.has(p)))
    .filter(i => { if (!search.trim()) return true; const q = search.toLowerCase(); return (i.title + i.summary + i.relevance + i.soWhat + (i.points || []).join(' ') + (i.actions || []).join(' ')).toLowerCase().includes(q) })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="pg-title">🔭 リサーチャー</div>
        <button onClick={openNew} style={btnPrimary}>+ インサイトを作成</button>
      </div>
      <div className="pg-sub">外部情報を「自社事業との関わり」と「従業員への示唆」に変換して届ける。学び・気づき・実行・貢献につなげるアウトプット面。</div>

      {/* 統計 */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 14 }}>
        {[['公開インサイト', published.length, 'var(--ink)'], ['今週の新着', newThisWeek, '#2563eb'], ['👍 役立った 累計', totalHelpful, '#16a34a'], ['💡 学びになった 累計', totalLearned, '#7c3aed']].map(([label, count, color]) => (
          <div key={String(label)} className="sc">
            <div className="sc-ey">{label}</div>
            <div className="sc-v" style={{ color: String(color) }}>{count}</div>
          </div>
        ))}
      </div>

      {/* フィルター */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={flabel}>カテゴリ</span>
          {CATEGORIES.map(c => <button key={c} onClick={() => toggleSet(setFilterCat, c)} style={chip(filterCat.has(c))}>{c}</button>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={flabel}>プロダクト</span>
          {OUR_PRODUCTS.map(p => <button key={p} onClick={() => toggleSet(setFilterProduct, p)} style={chip(filterProduct.has(p))}>{p}</button>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={flabel}>状態</span>
          {([['all', 'すべて'], ['published', '公開'], ['draft', '下書き']] as [typeof filterStatus, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setFilterStatus(v)} style={chip(filterStatus === v)}>{l}</button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="検索..." style={{ ...inp, width: 180, marginLeft: 'auto' }} />
        </div>
      </div>

      {loading && <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>読み込み中...</div>}
      {!loading && filtered.length === 0 && <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>インサイトがありません。「+ インサイトを作成」から登録してください。</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
        {filtered.map(it => {
          const open = expandedId === it.id
          return (
            <div key={it.id} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8, opacity: it.status === 'draft' ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: catColor[it.category] || '#666', padding: '1px 7px', borderRadius: 10 }}>{it.category}</span>
                {(it.products || []).map(p => <span key={p} style={{ fontSize: 9, background: 'var(--bg)', border: '0.5px solid var(--b1)', color: 'var(--ink2)', padding: '1px 6px', borderRadius: 10 }}>{p}</span>)}
                {it.status === 'draft' && <span style={{ fontSize: 9, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>下書き</span>}
                <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 'auto' }}>{it.publishedAt || (it.createdAt || '').slice(0, 10)}</span>
              </div>

              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4 }}>{it.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>{it.summary}</div>

              {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '0.5px solid var(--b1)', paddingTop: 8 }}>
                  {(it.points || []).length > 0 && (
                    <div><div style={detailLabel}>キーポイント</div>{(it.points || []).map((p, i) => <div key={i} style={bullet}>・{p}</div>)}</div>
                  )}
                  {it.relevance && <div><div style={detailLabel}>自社事業との関わり</div><div style={detailText}>{it.relevance}</div></div>}
                  {it.soWhat && <div style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 6, padding: '8px 10px' }}><div style={{ ...detailLabel, color: '#16a34a' }}>💡 従業員への示唆（So What）</div><div style={detailText}>{it.soWhat}</div></div>}
                  {(it.actions || []).length > 0 && (
                    <div><div style={detailLabel}>推奨アクション</div>
                      {(it.actions || []).map((a, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <div style={{ ...bullet, flex: 1 }}>・{a}</div>
                          <button onClick={() => toTask(it, a)} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, border: '0.5px solid var(--b1)', background: taskedAction === it.id + '::' + a ? 'var(--gbg)' : 'var(--bg)', color: taskedAction === it.id + '::' + a ? 'var(--green)' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>{taskedAction === it.id + '::' + a ? '✓ タスク化' : '→ タスク化'}</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {it.sourceRef && <div style={{ fontSize: 10, color: 'var(--muted)' }}>ソース：{/^https?:/.test(it.sourceRef) ? <a href={it.sourceRef} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>{it.sourceRef}</a> : it.sourceRef}</div>}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <button onClick={() => react(it, 'helpful')} style={reactBtn}>👍 役立った <b>{it.reactions?.helpful || 0}</b></button>
                <button onClick={() => react(it, 'learned')} style={reactBtn}>💡 学びになった <b>{it.reactions?.learned || 0}</b></button>
                <button onClick={() => setExpandedId(open ? null : it.id)} style={{ ...miniBtn, marginLeft: 'auto' }}>{open ? '閉じる' : '詳細'}</button>
                <button onClick={() => togglePublish(it)} style={miniBtn} title="公開/下書き切替">{it.status === 'published' ? '下書きに' : '公開する'}</button>
                <button onClick={() => openEdit(it)} style={miniBtn}>編集</button>
                <button onClick={() => remove(it.id)} style={{ ...miniBtn, color: 'var(--muted)' }}>🗑</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 作成・編集モーダル */}
      {showForm && (
        <div style={overlay} onClick={() => !saving && setShowForm(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{editId ? 'インサイトを編集' : 'インサイトを作成'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button>
            </div>

            {/* AIアシスト */}
            {!editId && (
              <div style={{ background: 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>🤖 AIアシスト（情報源を貼ると草案を自動生成）</div>
                <textarea value={aiSource} onChange={e => setAiSource(e.target.value)} placeholder="競合記事・ニュース・ナレッジ等の本文を貼り付け" style={{ ...inp, minHeight: 90, resize: 'vertical' }} />
                <button onClick={runAi} disabled={aiLoading} style={{ ...btnPrimary, width: '100%', marginTop: 8, opacity: aiLoading ? 0.6 : 1 }}>{aiLoading ? '🤖 生成中...' : '🤖 AIで骨子を生成'}</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={lbl}>タイトル<input value={form.title} onChange={e => setF('title', e.target.value)} style={inp} placeholder="一目で要点が分かる見出し" /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={lbl}>カテゴリ<select value={form.category} onChange={e => setF('category', e.target.value)} style={inp}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
                <label style={lbl}>状態<select value={form.status} onChange={e => setF('status', e.target.value as 'draft' | 'published')} style={inp}><option value="published">公開</option><option value="draft">下書き</option></select></label>
              </div>
              <div>
                <div style={lblText}>関連プロダクト</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {OUR_PRODUCTS.map(p => <button key={p} onClick={() => toggleProduct(p)} style={chip(form.products.includes(p))}>{p}</button>)}
                </div>
              </div>
              <label style={lbl}>要点（サマリー）<textarea value={form.summary} onChange={e => setF('summary', e.target.value)} style={{ ...inp, minHeight: 54, resize: 'vertical' }} placeholder="2〜3文で" /></label>
              <label style={lbl}>キーポイント（1行に1つ）<textarea value={form.points.join('\n')} onChange={e => setF('points', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="箇条書きを改行区切りで" /></label>
              <label style={lbl}>自社事業との関わり<textarea value={form.relevance} onChange={e => setF('relevance', e.target.value)} style={{ ...inp, minHeight: 48, resize: 'vertical' }} placeholder="どのプロダクト/施策にどう効くか" /></label>
              <label style={lbl}>従業員への示唆（So What）<textarea value={form.soWhat} onChange={e => setF('soWhat', e.target.value)} style={{ ...inp, minHeight: 48, resize: 'vertical' }} placeholder="学び・気づき" /></label>
              <label style={lbl}>推奨アクション（1行に1つ）<textarea value={form.actions.join('\n')} onChange={e => setF('actions', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} style={{ ...inp, minHeight: 48, resize: 'vertical' }} placeholder="従業員が取れる具体アクション" /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={lbl}>ソース（URL等・任意）<input value={form.sourceRef} onChange={e => setF('sourceRef', e.target.value)} style={inp} placeholder="https://..." /></label>
                <label style={lbl}>作成者（任意）<input value={form.author} onChange={e => setF('author', e.target.value)} style={inp} placeholder="リサーチャー名" /></label>
              </div>

              {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} disabled={saving} style={btnGhost}>キャンセル</button>
              <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const flabel: CSSProperties = { fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 64 }
const chip = (active: boolean): CSSProperties => ({ padding: '3px 10px', border: '0.5px solid ' + (active ? 'var(--ink)' : 'var(--b1)'), borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--ink)' : 'none', color: active ? '#fff' : 'var(--ink2)' })
const detailLabel: CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 3, letterSpacing: '0.04em' }
const detailText: CSSProperties = { fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }
const bullet: CSSProperties = { fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6, paddingLeft: 4 }
const reactBtn: CSSProperties = { fontSize: 10, padding: '4px 9px', borderRadius: 14, border: '0.5px solid var(--b1)', background: 'var(--bg)', color: 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }
const miniBtn: CSSProperties = { fontSize: 10, padding: '4px 8px', borderRadius: 4, border: '0.5px solid var(--b1)', background: 'none', color: 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnPrimary: CSSProperties = { padding: '5px 14px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost: CSSProperties = { padding: '6px 14px', background: 'none', border: '0.5px solid var(--b1)', color: 'var(--muted)', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modal: CSSProperties = { background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 24, width: 540, fontFamily: 'inherit', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: '90vh', overflowY: 'auto' }
const lbl: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted)', fontFamily: 'inherit' }
const lblText: CSSProperties = { fontSize: 11, color: 'var(--muted)', marginBottom: 6 }
const inp: CSSProperties = { border: '0.5px solid var(--b1)', borderRadius: 4, padding: '7px 9px', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', width: '100%', boxSizing: 'border-box' }
