'use client'
import { useState } from 'react'

type TaskStatus = 'todo' | 'doing' | 'done' | 'waiting' | 'delayed'
interface Task {
  施策: string; name: string; s: string; e: string
  own: 'molts' | 'samurai' | 'both'; st: TaskStatus; chg: boolean
  assignee?: string; blocker?: boolean; impact?: string; src?: string
}
interface Members { samurai: string[]; molts: string[] }
interface Props {
  tasks: Task[]
  members: Members
  onStatusChange: (idx: number, st: string) => void
  onOpenModal: (task: Task | null) => void
}

const statusLabel: Record<TaskStatus, string> = {
  todo: '未着手', doing: '進行中', done: '完了', waiting: '対応待ち', delayed: '遅れあり'
}
const ownerLabel: Record<string, string> = { molts: 'THE MOLTS', samurai: 'SAMURAI', both: '共同' }
const ownerCls: Record<string, string> = { molts: 'ob-m', samurai: 'ob-s', both: 'ob-b' }

function dueInfo(e: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = Math.ceil((new Date(e).getTime() - today.getTime()) / 86400000)
  if (d < 0) return { text: String(Math.abs(d)) + '日超過', color: 'var(--orange)', date: e.slice(5).replace('-', '/') }
  if (d === 0) return { text: '今日', color: 'var(--orange)', date: e.slice(5).replace('-', '/') }
  if (d <= 3) return { text: '残' + String(d) + '日', color: 'var(--yellow)', date: e.slice(5).replace('-', '/') }
  return { text: '残' + String(d) + '日', color: 'var(--muted)', date: e.slice(5).replace('-', '/') }
}

export default function TaskTracker({ tasks, members, onStatusChange, onOpenModal }: Props) {
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [sortBy, setSortBy] = useState('registered')
  const [filterSrc, setFilterSrc] = useState('all')

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

  const fbtn = (active: boolean) => ({
    padding: '3px 10px',
    border: '0.5px solid ' + (active ? 'var(--ink)' : 'var(--b1)'),
    borderRadius: 20, fontSize: 11, cursor: 'pointer' as const,
    fontFamily: 'inherit', background: active ? 'var(--ink)' : 'none',
    color: active ? '#fff' : 'var(--ink2)',
  })

  const waiting = tasks.filter(t => t.st === 'waiting').length
  const delayed = tasks.filter(t => t.st === 'delayed').length
  const doing = tasks.filter(t => t.st === 'doing').length
  const done = tasks.filter(t => t.st === 'done').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="pg-title">タスクトラッカー</div>
        <button onClick={() => onOpenModal(null)} style={{ padding: '5px 14px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>+ タスク追加</button>
      </div>
      <div className="pg-sub">対応待ち・遅れあり・進行中タスクを優先度別に管理する</div>

      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>ステータス</span>
          {['all', 'doing', 'waiting', 'delayed', 'todo', 'done'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={fbtn(filterStatus === s)}>
              {s === 'all' ? 'すべて' : s === 'doing' ? '進行中' : s === 'waiting' ? '対応待ち' : s === 'delayed' ? '遅れあり' : s === 'todo' ? '未着手' : '完了'}
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

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[['対応待ち', waiting, 'var(--red)'], ['遅れあり', delayed, 'var(--orange)'], ['進行中', doing, 'var(--yellow)'], ['完了', done, 'var(--green)']].map(([label, count, color]) => (
          <div key={String(label)} className="sc">
            <div className="sc-ey">{label}</div>
            <div className="sc-v" style={{ color: String(color) }}>{count}</div>
          </div>
        ))}
      </div>

      <div className="cw">
        {filtered.length === 0 && <div style={{ padding: '20px 14px', color: 'var(--muted)', fontSize: 12 }}>該当するタスクがありません</div>}
        {filtered.map(t => {
          const due = t.e ? dueInfo(t.e) : null
          const idx = tasks.indexOf(t)
          return (
            <div key={t.name} className="ir" style={{ opacity: t.st === 'done' ? 0.4 : 1 }}>
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
              </div>
              <select className="st-sel" value={t.st} onChange={e => onStatusChange(idx, e.target.value)}>
                {(Object.entries(statusLabel) as [TaskStatus, string][]).map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
