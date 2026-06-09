'use client'
import { useState } from 'react'

type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'waiting' | 'delayed'
interface Task {
  id?: string
  施策: string; name: string; s: string; e: string
  own: 'molts' | 'samurai' | 'both'; st: TaskStatus; chg: boolean
  assignee?: string; blocker?: boolean; impact?: string; src?: string; 備考?: string; 背景?: string; 背景ソース?: string; phase?: string
}
interface Members { samurai: string[]; molts: string[] }
interface Props {
  tasks: Task[]
  members: Members
  onStatusChange: (idx: number, st: string) => void
  onBulkStatusChange: (names: string[], st: string) => void
  onOpenModal: (task: Task | null) => void
}

const statusLabel: Record<TaskStatus, string> = {
  todo: '未着手', doing: '進行中', review: '定例確認', done: '完了', waiting: '対応待ち', delayed: '遅れあり'
}
// 一括変更で選べるステータス
const bulkStatusOptions: [TaskStatus, string][] = [['todo', '未着手'], ['doing', '進行中'], ['review', '定例確認'], ['done', '完了']]
const ownerLabel: Record<string, string> = { molts: 'THE MOLTS', samurai: 'SAMURAI', both: '共同' }
const ownerCls: Record<string, string> = { molts: 'ob-m', samurai: 'ob-s', both: 'ob-b' }

// ローカル日付を 'YYYY-MM-DD' に
const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function dueInfo(e: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = Math.ceil((new Date(e).getTime() - today.getTime()) / 86400000)
  if (d < 0) return { text: String(Math.abs(d)) + '日超過', color: 'var(--orange)', date: e.slice(5).replace('-', '/') }
  if (d === 0) return { text: '今日', color: 'var(--orange)', date: e.slice(5).replace('-', '/') }
  if (d <= 3) return { text: '残' + String(d) + '日', color: 'var(--yellow)', date: e.slice(5).replace('-', '/') }
  return { text: '残' + String(d) + '日', color: 'var(--muted)', date: e.slice(5).replace('-', '/') }
}

// 期限別グループ（表示順）
const DEADLINE_GROUPS = ['期限切れ', '今日', '今週', '来週', 'それ以降', '期日なし'] as const
type DeadlineGroup = typeof DEADLINE_GROUPS[number]
const deadlineGroupLabel: Record<DeadlineGroup, string> = {
  '期限切れ': '📛 期限切れ', '今日': '📅 今日', '今週': '📅 今週', '来週': '📅 来週', 'それ以降': '📅 それ以降', '期日なし': '📋 期日なし'
}

export default function TaskTracker({ tasks, members, onStatusChange, onBulkStatusChange, onOpenModal }: Props) {
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [sortBy, setSortBy] = useState('registered')
  const [filterSrc, setFilterSrc] = useState('all')
  const [viewMode, setViewMode] = useState<'status' | 'deadline' | 'category'>('status')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<TaskStatus>('todo')
  const [expandedBg, setExpandedBg] = useState<Set<string>>(new Set())
  const toggleBg = (key: string) => setExpandedBg(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })

  const allMembers = [...members.samurai, ...members.molts]

  const filtered = [...tasks]
    .filter(t => filterStatus === 'all' || t.st === filterStatus)
    .filter(t => filterAssignee === 'all' || t.assignee === filterAssignee)
    .filter(t => filterSrc === 'all' || (filterSrc === 'slack' && t.src === 'slack') || (filterSrc === 'fireflies' && t.src && t.src !== 'slack') || (filterSrc === 'none' && !t.src))
    .sort((a, b) => {
      if (sortBy === 'registered') {
        const ai = tasks.indexOf(a), bi = tasks.indexOf(b)
        return bi - ai  // 新しい順（末尾が新しい）
      }
      if (sortBy === 'blocker' && (a.blocker ?? false) !== (b.blocker ?? false)) return a.blocker ? -1 : 1
      if (sortBy !== 'registered') {
        const ae = a.e || '9999-99-99', be = b.e || '9999-99-99'
        return ae < be ? -1 : ae > be ? 1 : 0
      }
      return 0
    })

  // 期限別グルーピング（期日 e は 'YYYY-MM-DD' 文字列で比較）
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayStr = toYMD(today)
  const plus = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return toYMD(d) }
  const d7 = plus(7), d14 = plus(14)
  const groupOf = (t: Task): DeadlineGroup => {
    if (!t.e) return '期日なし'
    if (t.e < todayStr) return t.st !== 'done' ? '期限切れ' : '期日なし'
    if (t.e === todayStr) return '今日'
    if (t.e <= d7) return '今週'
    if (t.e <= d14) return '来週'
    return 'それ以降'
  }
  const deadlineGroups: Record<DeadlineGroup, Task[]> = { '期限切れ': [], '今日': [], '今週': [], '来週': [], 'それ以降': [], '期日なし': [] }
  filtered.forEach(t => deadlineGroups[groupOf(t)].push(t))

  // カテゴリ別グルーピング（施策フィールド。未設定は「未分類」）。出現順を保持
  const categoryOrder: string[] = []
  const categoryGroups: Record<string, Task[]> = {}
  filtered.forEach(t => {
    const c = t.施策 || '未分類'
    if (!categoryGroups[c]) { categoryGroups[c] = []; categoryOrder.push(c) }
    categoryGroups[c].push(t)
  })

  const fbtn = (active: boolean) => ({
    padding: '3px 10px',
    border: '0.5px solid ' + (active ? 'var(--ink)' : 'var(--b1)'),
    borderRadius: 20, fontSize: 11, cursor: 'pointer' as const,
    fontFamily: 'inherit', background: active ? 'var(--ink)' : 'none',
    color: active ? '#fff' : 'var(--ink2)',
  })

  const waiting = tasks.filter(t => t.st === 'waiting').length
  const delayed = tasks.filter(t => t.st === 'delayed').length
  const review = tasks.filter(t => t.st === 'review').length
  const doing = tasks.filter(t => t.st === 'doing').length
  const done = tasks.filter(t => t.st === 'done').length

  // 選択は id ベースで管理（id 未設定の旧データは name にフォールバック）
  const keyOf = (t: Task) => t.id ?? t.name
  const toggleSel = (key: string) => setSelected(s => {
    const n = new Set(s)
    if (n.has(key)) n.delete(key); else n.add(key)
    return n
  })
  const clearSel = () => setSelected(new Set())
  const applyBulk = () => {
    if (selected.size === 0) return
    onBulkStatusChange([...selected], bulkStatus)
    clearSel()
  }

  const renderRow = (t: Task) => {
    const due = t.e ? dueInfo(t.e) : null
    const idx = tasks.indexOf(t)
    return (
      <div key={keyOf(t)} className="ir" style={{ opacity: t.st === 'done' ? 0.4 : 1 }}>
        <input type="checkbox" checked={selected.has(keyOf(t))} onChange={() => toggleSel(keyOf(t))} style={{ marginTop: 3, cursor: 'pointer', flexShrink: 0 }} />
        <div className="ib">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {t.blocker && <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--rbg)', color: 'var(--red)', padding: '1px 6px', borderRadius: 3 }}>ブロッカー</span>}
            <div className="it" style={{ cursor: 'pointer' }} onClick={() => onOpenModal(t)}>{t.name}</div>
          </div>
          <div className="im">
            <span className="stag">{t.施策}</span>
            <span className={'ob ' + ownerCls[t.own]}>{t.assignee || ownerLabel[t.own]}</span>
            {due && <span style={{ fontSize: 10, fontWeight: 500, color: due.color }}>{due.date} ({due.text})</span>}
            {t.src === 'slack' && <span style={{ fontSize: 9, background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>Slack</span>}
            {t.src && t.src !== 'slack' && <span style={{ fontSize: 9, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>📋 {t.src.replace(/^\d{4}-\d{2}-\d{2}\s*/, '')}</span>}
          </div>
          {t.impact && <div className="id">{t.impact}</div>}
          {t.背景 && (
            <div style={{ marginTop: 3 }}>
              <span onClick={() => toggleBg(keyOf(t))} style={{ fontSize: 10, color: 'var(--muted)', cursor: 'pointer' }}>{expandedBg.has(keyOf(t)) ? '▼' : '▶'} 背景・追加経緯</span>
              {expandedBg.has(keyOf(t)) && (
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>背景：{t.背景}{t.背景ソース ? `（${t.背景ソース}）` : ''}</div>
              )}
            </div>
          )}
        </div>
        <select className="st-sel" value={t.st} onChange={e => onStatusChange(idx, e.target.value)}>
          {(Object.entries(statusLabel) as [TaskStatus, string][]).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="pg-title">タスクトラッカー</div>
        <button onClick={() => onOpenModal(null)} style={{ padding: '5px 14px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>+ タスク追加</button>
      </div>
      <div className="pg-sub">対応待ち・遅れあり・進行中タスクを優先度別に管理する</div>

      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>表示</span>
          {([['status', 'ステータス別'], ['deadline', '期限別'], ['category', 'カテゴリ別']] as ['status' | 'deadline' | 'category', string][]).map(([val, label]) => (
            <button key={val} onClick={() => setViewMode(val)} style={fbtn(viewMode === val)}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>ステータス</span>
          {['all', 'doing', 'review', 'waiting', 'delayed', 'todo', 'done'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={fbtn(filterStatus === s)}>
              {s === 'all' ? 'すべて' : s === 'doing' ? '進行中' : s === 'review' ? '定例確認' : s === 'waiting' ? '対応待ち' : s === 'delayed' ? '遅れあり' : s === 'todo' ? '未着手' : '完了'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>担当者</span>
          {['all', ...allMembers].map(m => (
            <button key={m} onClick={() => setFilterAssignee(m)} style={fbtn(filterAssignee === m)}>
              {m === 'all' ? '全員' : m}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>並び順</span>
          {[['deadline', '期日順'], ['blocker', 'ブロッカー優先'], ['registered', '登録順']].map(([val, label]) => (
            <button key={val} onClick={() => setSortBy(val)} style={fbtn(sortBy === val)}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>ソース元</span>
          {([['all', 'すべて'], ['slack', 'Slack'], ['fireflies', 'Fireflies'], ['none', 'その他']] as [string,string][]).map(([val, label]) => (
            <button key={val} onClick={() => setFilterSrc(val)} style={fbtn(filterSrc === val)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {[['対応待ち', waiting, 'var(--red)'], ['遅れあり', delayed, 'var(--orange)'], ['定例確認', review, '#1d4ed8'], ['進行中', doing, 'var(--yellow)'], ['完了', done, 'var(--green)']].map(([label, count, color]) => (
          <div key={String(label)} className="sc">
            <div className="sc-ey">{label}</div>
            <div className="sc-v" style={{ color: String(color) }}>{count}</div>
          </div>
        ))}
      </div>

      {viewMode === 'status' ? (
        <div className="cw">
          {filtered.length === 0 && <div style={{ padding: '20px 14px', color: 'var(--muted)', fontSize: 12 }}>該当するタスクがありません</div>}
          {filtered.map(renderRow)}
        </div>
      ) : viewMode === 'deadline' ? (
        <div>
          {filtered.length === 0 && <div className="cw"><div style={{ padding: '20px 14px', color: 'var(--muted)', fontSize: 12 }}>該当するタスクがありません</div></div>}
          {DEADLINE_GROUPS.filter(g => deadlineGroups[g].length > 0).map(g => (
            <div key={g} style={{ marginBottom: 12 }}>
              <div className="sh" style={{ marginBottom: 8 }}>{deadlineGroupLabel[g]}（{deadlineGroups[g].length}）</div>
              <div className="cw">
                {deadlineGroups[g].map(renderRow)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {filtered.length === 0 && <div className="cw"><div style={{ padding: '20px 14px', color: 'var(--muted)', fontSize: 12 }}>該当するタスクがありません</div></div>}
          {categoryOrder.map(c => (
            <div key={c} style={{ marginBottom: 12 }}>
              <div className="sh" style={{ marginBottom: 8 }}>{c}（{categoryGroups[c].length}）</div>
              <div className="cw">
                {categoryGroups[c].map(renderRow)}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 500, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--ink)', color: '#fff', borderRadius: 'var(--r)', padding: '10px 16px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)' }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{selected.size}件選択中</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as TaskStatus)}
            style={{ border: '0.5px solid rgba(255,255,255,0.3)', borderRadius: 4, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer' }}>
            {bulkStatusOptions.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
          </select>
          <button onClick={applyBulk} style={{ padding: '5px 14px', background: '#fff', color: 'var(--ink)', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>変更する</button>
          <button onClick={clearSel} style={{ padding: '5px 12px', background: 'none', color: '#fff', border: '0.5px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>選択解除</button>
        </div>
      )}
    </div>
  )
}
