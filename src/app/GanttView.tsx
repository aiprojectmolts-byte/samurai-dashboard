'use client'

import React, { useState, useEffect } from 'react'

type TaskStatus = 'todo' | 'doing' | 'done' | 'waiting' | 'delayed'

interface Task {
  施策: string
  name: string
  s: string
  e: string
  own: 'molts' | 'samurai' | 'both'
  st: TaskStatus
  chg: boolean
  assignee?: string
  blocker?: boolean
  impact?: string
  src?: string
}

const defaultTasks: Task[] = [
  { 施策: '施策1', name: 'フォームに流入元項目追加', s: '2026-06-01', e: '2026-06-07', own: 'both', st: 'done', chg: false },
  { 施策: '施策2', name: '主要取引先への許諾交渉', s: '2026-06-01', e: '2026-06-28', own: 'samurai', st: 'waiting', chg: false },
  { 施策: '施策2', name: '事例1本目：取材・執筆・公開', s: '2026-07-01', e: '2026-07-19', own: 'molts', st: 'todo', chg: false },
  { 施策: '施策2', name: '事例2・3本目', s: '2026-08-01', e: '2026-08-24', own: 'molts', st: 'todo', chg: false },
  { 施策: '施策3', name: 'VISIOAL LP ワイヤー・コピー', s: '2026-06-08', e: '2026-06-14', own: 'molts', st: 'doing', chg: false },
  { 施策: '施策3', name: 'VISIOAL LP デザイン・実装・公開', s: '2026-06-15', e: '2026-07-12', own: 'molts', st: 'todo', chg: false },
  { 施策: '施策4', name: '既存LP 業界課題の数字追加', s: '2026-06-01', e: '2026-06-14', own: 'molts', st: 'delayed', chg: true },
  { 施策: '施策5', name: '加藤CEO ヒアリング', s: '2026-06-01', e: '2026-06-07', own: 'both', st: 'done', chg: false },
  { 施策: '施策5', name: 'CEO 1・2本目発信', s: '2026-06-08', e: '2026-06-21', own: 'samurai', st: 'doing', chg: false },
  { 施策: '施策5', name: 'CEO LinkedIn整備・発信', s: '2026-08-01', e: '2026-08-31', own: 'samurai', st: 'todo', chg: false },
  { 施策: '施策6', name: 'リファラル トーク設計', s: '2026-06-01', e: '2026-06-07', own: 'molts', st: 'done', chg: false },
  { 施策: '施策6', name: '既存取引先への声がけ', s: '2026-06-08', e: '2026-09-07', own: 'samurai', st: 'doing', chg: false },
  { 施策: '施策7', name: 'リファラル制度設計', s: '2026-09-01', e: '2026-09-20', own: 'both', st: 'todo', chg: false },
]

const statusLabel: Record<TaskStatus, string> = {
  todo: '未着手', doing: '進行中', done: '完了', waiting: '対応待ち', delayed: '遅れあり'
}

const ownerLabel = { molts: 'THE MOLTS', samurai: 'SAMURAI', both: '共同' }
const ownerClass = { molts: 'ob-m', samurai: 'ob-s', both: 'ob-b' }

const barColor: Record<TaskStatus, string> = {
  todo: '#b0b8c4',
  doing: '#f59e0b',
  done: '#4ade80',
  waiting: '#f87171',
  delayed: '#c2410c',
}

const generateWeeks = () => {
  const weeks: { label: string; month: string; start: string; end: string }[] = []
  const months = [
    { label: '6月', year: 2026, month: 5 },
    { label: '7月', year: 2026, month: 6 },
    { label: '8月', year: 2026, month: 7 },
    { label: '9月', year: 2026, month: 8 },
  ]
  let wNum = 1
  months.forEach(m => {
    const d = new Date(m.year, m.month, 1)
    while (d.getMonth() === m.month) {
      const s = d.toISOString().split('T')[0]
      const e = new Date(d)
      e.setDate(e.getDate() + 6)
      weeks.push({ label: `W${wNum}\n${d.getMonth()+1}/${d.getDate()}`, month: m.label, start: s, end: e.toISOString().split('T')[0] })
      d.setDate(d.getDate() + 7)
      wNum++
    }
  })
  return weeks
}

const weeks = generateWeeks()
const TODAY = '2026-06-09'
const currentWeekIdx = weeks.findIndex(w => TODAY >= w.start && TODAY <= w.end)

const monthGroups: { label: string; count: number }[] = []
weeks.forEach(w => {
  const last = monthGroups[monthGroups.length - 1]
  if (last && last.label === w.month) last.count++
  else monthGroups.push({ label: w.month, count: 1 })
})

// 施策グループ（区切り行用）
const buildGroups = (tasks: Task[]) => {
  const seen = new Set<string>()
  const groups: string[] = []
  tasks.forEach(t => { if (!seen.has(t.施策)) { seen.add(t.施策); groups.push(t.施策) } })
  return groups
}

interface Members { samurai: string[]; molts: string[] }

interface Props {
  tasks?: Task[]
  members?: Members
  onTasksChange?: (tasks: Task[]) => void
  onEditTask?: (task: Task) => void
}

const CW = 48

export default function GanttView({ tasks: propTasks, members, onTasksChange, onEditTask }: Props) {
  const [tasks, setTasks] = useState<Task[]>(propTasks || defaultTasks)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [sortBy, setSortBy] = useState('registered')
  const [filterSrc, setFilterSrc] = useState('all')

  const allMembers = members ? [...members.samurai, ...members.molts] : []

  const filteredTasks = [...tasks]
    .filter(t => filterStatus === 'all' || t.st === filterStatus)
    .filter(t => filterAssignee === 'all' || t.assignee === filterAssignee)
    .filter(t => filterSrc === 'all' || (filterSrc === 'slack' && t.src === 'slack') || (filterSrc === 'fireflies' && t.src && t.src !== 'slack') || (filterSrc === 'none' && !t.src))
    .sort((a, b) => {
      if (sortBy === 'registered') {
        const ai = tasks.indexOf(a), bi = tasks.indexOf(b)
        return ai - bi
      }
      if (sortBy === 'blocker') {
        if ((a.blocker ?? false) !== (b.blocker ?? false)) return a.blocker ? -1 : 1
      }
      const ae = a.e || '9999-99-99', be = b.e || '9999-99-99'
      return ae < be ? -1 : ae > be ? 1 : 0
    })

  const fbtn = (active: boolean) => ({
    padding: '3px 10px',
    border: '0.5px solid ' + (active ? 'var(--ink)' : 'var(--b1)'),
    borderRadius: 20, fontSize: 11, cursor: 'pointer' as const,
    fontFamily: 'inherit', background: active ? 'var(--ink)' : 'none',
    color: active ? '#fff' : 'var(--ink2)',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (propTasks && propTasks.length > 0) setTasks(propTasks)
  }, [propTasks])

  const updateStatus = (taskName: string, st: TaskStatus) => {
    const updated = tasks.map(t => t.name === taskName ? { ...t, st } : t)
    setTasks(updated)
    onTasksChange?.(updated)
  }

  const toggleDone = (taskName: string) => {
    const t = tasks.find(t => t.name === taskName)!
    updateStatus(taskName, t.st === 'done' ? 'doing' : 'done')
  }

  const sakuGroups = buildGroups(filteredTasks)

  const renderBarCells = (s: string, e: string, st: TaskStatus, chg: boolean, isGroup = false) => {
    const si = weeks.findIndex(w => s <= w.end && e >= w.start)
    const ei = [...weeks].map((w, i) => ({ w, i })).reverse().find(({ w }) => s <= w.end && e >= w.start)?.i ?? -1
    return weeks.map((w, wi) => {
      const isCw = wi === currentWeekIdx
      const hasBar = si !== -1 && wi >= si && wi <= ei
      const isStart = wi === si
      const isEnd = wi === ei
      return (
        <td key={wi} style={{ minWidth: CW, padding: '0 1px', background: isCw ? 'rgba(0,0,0,0.02)' : undefined }}>
          {hasBar && (
            <div style={{ height: 22, position: 'relative' }}>
              <div style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                height: isGroup ? 8 : 13,
                background: barColor[st],
                opacity: isGroup ? 0.45 : 1,
                left: isStart ? 4 : 0,
                right: isEnd ? 4 : 0,
                borderRadius: isStart && isEnd ? 3 : isStart ? '3px 0 0 3px' : isEnd ? '0 3px 3px 0' : 0,
              }}>
                {chg && isEnd && (
                  <div style={{ position: 'absolute', top: 1, right: 3, width: 4, height: 4, background: 'var(--orange)', borderRadius: '50%' }} />
                )}
              </div>
            </div>
          )}
        </td>
      )
    })
  }

  return (
    <div>
      <style>{`
        .g-scroll { overflow-x: auto; }
        .g-table { border-collapse: collapse; min-width: 100%; }
        .g-mrow th { padding: 5px 0; text-align: center; font-size: 10px; font-weight: 600; color: var(--ink2); background: #fafaf9; border-bottom: 0.5px solid var(--b1); }
        .g-wrow th { padding: 3px 0; text-align: center; font-size: 10px; color: var(--muted); background: #fafaf9; border-bottom: 0.5px solid var(--b1); white-space: pre; line-height: 1.3; }
        .g-wrow th.cw { background: #f0f0ef; color: var(--ink2); font-weight: 600; }
        .g-group td { border-bottom: 0.5px solid var(--b1); height: 32px; vertical-align: middle; padding: 0; background: #fafaf9; }
        .g-row td { border-bottom: 0.5px solid var(--b2); height: 36px; vertical-align: middle; padding: 0; background: var(--paper); }
        .g-row:hover td { background: #fafaf9; }
        .g-row.done-row td { opacity: 0.38; }
        .t-label { padding: 4px 10px; white-space: nowrap; position: sticky; left: 0; z-index: 10; min-width: 320px; max-width: 320px; border-right: 0.5px solid var(--b1); }
        .g-group .t-label { background: #fafaf9; font-size: 11px; font-weight: 600; color: var(--ink2); }
        .g-row .t-label { background: var(--paper); }
        .g-row:hover .t-label { background: #fafaf9; }
        .row-inner { display: flex; align-items: center; gap: 6px; padding-left: 12px; }
        .t-check { width: 14px; height: 14px; border: 1.5px solid var(--b1); border-radius: 4px; flex-shrink: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #fff; transition: all 0.1s; }
        .t-check:hover { border-color: var(--ink2); }
        .t-check.done { background: var(--green); border-color: var(--green); }
        .t-name { font-size: 11px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px; color: var(--ink); }
        .delay-tag { font-size: 9px; color: var(--orange); background: var(--obg); padding: 1px 5px; border-radius: 3px; flex-shrink: 0; }
        .owner-cell { padding: 4px 8px; border-left: 0.5px solid var(--b1); white-space: nowrap; position: sticky; right: 80px; z-index: 9; min-width: 80px; }
        .g-group .owner-cell { background: #fafaf9; }
        .g-row .owner-cell { background: var(--paper); }
        .g-row:hover .owner-cell { background: #fafaf9; }
        .action-cell { padding: 4px 6px; white-space: nowrap; position: sticky; right: 0; z-index: 9; border-left: 0.5px solid var(--b1); min-width: 80px; }
        .g-group .action-cell { background: #fafaf9; }
        .g-row .action-cell { background: var(--paper); }
        .g-row:hover .action-cell { background: #fafaf9; }
        .st-sel { border: 0.5px solid var(--b1); border-radius: 3px; padding: 2px 4px; font-size: 10px; font-family: inherit; cursor: pointer; background: var(--paper); color: var(--ink2); }
        .gleg { display: flex; gap: 10px; flex-wrap: wrap; padding: 8px 14px; border-bottom: 0.5px solid var(--b1); background: #fafaf9; }
        .gli { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--muted); }
        .gld { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
        .ob { font-size: 10px; font-weight: 500; padding: 2px 7px; border-radius: 10px; }
        .ob-m { background: #f0f0ef; color: var(--ink2); }
        .ob-s { background: var(--ybg); color: #7c4f00; }
        .ob-b { background: var(--gbg); color: var(--green); }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>ステータス</span>
            {['all', 'doing', 'waiting', 'delayed', 'todo', 'done'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} style={fbtn(filterStatus === s)}>
                {s === 'all' ? 'すべて' : s === 'doing' ? '進行中' : s === 'waiting' ? '対応待ち' : s === 'delayed' ? '遅れあり' : s === 'todo' ? '未着手' : '完了'}
              </button>
            ))}
          </div>
          {allMembers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>担当者</span>
              {['all', ...allMembers].map(m => (
                <button key={m} onClick={() => setFilterAssignee(m)} style={fbtn(filterAssignee === m)}>{m === 'all' ? '全員' : m}</button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>並び順</span>
            {[['registered', '登録順'], ['deadline', '期日順'], ['blocker', 'ブロッカー優先']].map(([val, label]) => (
              <button key={val} onClick={() => setSortBy(val)} style={fbtn(sortBy === val)}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>ソース元</span>
            {[['all', 'すべて'], ['slack', 'Slack'], ['fireflies', 'Fireflies'], ['none', 'その他']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterSrc(val)} style={fbtn(filterSrc === val)}>{label}</button>
            ))}
          </div>
        </div>
        {saving && <span style={{ fontSize: 10, color: 'var(--muted)' }}>保存中...</span>}
      </div>

      <div className="cw">
        <div className="gleg">
          {Object.entries(barColor).map(([st, color]) => (
            <div key={st} className="gli"><div className="gld" style={{ background: color }} />{statusLabel[st as TaskStatus]}</div>
          ))}
          <div className="gli"><div className="gld" style={{ background: 'var(--orange)', borderRadius: '50%', width: 6, height: 6 }} />期日変更</div>
        </div>

        <div className="g-scroll">
          <table className="g-table">
            <thead>
              <tr className="g-mrow">
                <th style={{ minWidth: 320, borderRight: '0.5px solid var(--b1)', position: 'sticky', left: 0, zIndex: 11, background: '#fafaf9' }}></th>
                {monthGroups.map(m => (
                  <th key={m.label} colSpan={m.count} style={{ borderLeft: '0.5px solid var(--b1)' }}>{m.label}</th>
                ))}
                <th style={{ minWidth: 80, borderLeft: '0.5px solid var(--b1)', background: '#fafaf9', position: 'sticky', right: 80, zIndex: 11 }}>担当</th>
                <th style={{ minWidth: 80, background: '#fafaf9', position: 'sticky', right: 0, zIndex: 11, borderLeft: '0.5px solid var(--b1)' }}>ステータス</th>
              </tr>
              <tr className="g-wrow">
                <th style={{ borderRight: '0.5px solid var(--b1)', position: 'sticky', left: 0, zIndex: 11, background: '#fafaf9' }}></th>
                {weeks.map((w, i) => (
                  <th key={i} className={i === currentWeekIdx ? 'cw' : ''} style={{ minWidth: CW }}>{w.label}</th>
                ))}
                <th style={{ borderLeft: '0.5px solid var(--b1)', background: '#fafaf9', position: 'sticky', right: 80, zIndex: 11 }}></th>
                <th style={{ background: '#fafaf9', position: 'sticky', right: 0, zIndex: 11, borderLeft: '0.5px solid var(--b1)' }}></th>
              </tr>
            </thead>
            <tbody>
              {sakuGroups.map(施策 => {
                const groupTasks = filteredTasks.filter(t => t.施策 === 施策)
                const groupS = groupTasks.reduce((min, t) => t.s < min ? t.s : min, groupTasks[0].s)
                const groupE = groupTasks.reduce((max, t) => t.e > max ? t.e : max, groupTasks[0].e)
                const groupSt = groupTasks.reduce((worst, t) => {
                  const p: Record<TaskStatus, number> = { waiting: 5, delayed: 4, doing: 3, todo: 2, done: 1 }
                  return p[t.st] > p[worst] ? t.st : worst
                }, 'done' as TaskStatus)

                return (
                  <React.Fragment key={"group-" + 施策}>
                    {/* 施策グループ区切り行 */}
                    <tr className="g-group">
                      <td className="t-label">{施策}</td>
                      {renderBarCells(groupS, groupE, groupSt, false, true)}
                      <td className="owner-cell"></td>
                      <td className="action-cell"></td>
                    </tr>

                    {/* 子タスク行 */}
                    {groupTasks.map(t => (
                      <tr key={t.name} className={`g-row${t.st === 'done' ? ' done-row' : ''}`}>
                        <td className="t-label">
                          <div className="row-inner">
                            <div className={`t-check${t.st === 'done' ? ' done' : ''}`} onClick={() => toggleDone(t.name)}>
                              {t.st === 'done' ? '✓' : ''}
                            </div>
                            <span className="t-name" title={t.name} onClick={() => onEditTask?.(t)} style={{cursor:"pointer"}}>{t.name}</span>
                            {t.st === 'delayed' && <span className="delay-tag">遅れあり</span>}
                            {t.chg && <span className="delay-tag">変更</span>}
                          </div>
                        </td>
                        {renderBarCells(t.s, t.e, t.st, t.chg)}
                        <td className="owner-cell">
                          <span className={`ob ${ownerClass[t.own]}`}>{t.assignee || ownerLabel[t.own]}</span>
                        </td>
                        <td className="action-cell">
                          <select className="st-sel" value={t.st} onChange={e => updateStatus(t.name, e.target.value as TaskStatus)}>
                            {Object.entries(statusLabel).map(([val, lbl]) => (
                              <option key={val} value={val}>{lbl}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
