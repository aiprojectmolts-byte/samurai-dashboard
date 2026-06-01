'use client'

import { useState, useEffect } from 'react'

type TaskStatus = 'todo' | 'doing' | 'done' | 'waiting' | 'delayed'

interface Task {
  施策: string
  name: string
  s: string
  e: string
  own: 'molts' | 'samurai' | 'both'
  st: TaskStatus
  chg: boolean
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

// 週の生成
const generateWeeks = () => {
  const weeks: { label: string; month: string; start: string; end: string }[] = []
  const months = [
    { label: '6月', start: '2026-06-01' },
    { label: '7月', start: '2026-07-01' },
    { label: '8月', start: '2026-08-01' },
    { label: '9月', start: '2026-09-01' },
  ]
  let wNum = 1
  months.forEach(m => {
    const d = new Date(m.start)
    const month = m.label
    while (d.getMonth() === new Date(m.start).getMonth()) {
      const s = d.toISOString().split('T')[0]
      const e = new Date(d)
      e.setDate(e.getDate() + 6)
      weeks.push({ label: `W${wNum}\n${d.getMonth()+1}/${d.getDate()}`, month, start: s, end: e.toISOString().split('T')[0] })
      d.setDate(d.getDate() + 7)
      wNum++
    }
  })
  return weeks
}

const weeks = generateWeeks()
const TODAY = '2026-06-09'
const currentWeekIdx = weeks.findIndex(w => TODAY >= w.start && TODAY <= w.end)

// 月ごとに週をグループ
const monthGroups: { label: string; count: number }[] = []
weeks.forEach(w => {
  const last = monthGroups[monthGroups.length - 1]
  if (last && last.label === w.month) last.count++
  else monthGroups.push({ label: w.month, count: 1 })
})

interface Props {
  tasks?: Task[]
  onTasksChange?: (tasks: Task[]) => void
}

export default function GanttView({ tasks: propTasks, onTasksChange }: Props) {
  const [tasks, setTasks] = useState<Task[]>(propTasks || defaultTasks)
  const [filter, setFilter] = useState<string>('すべて')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (propTasks && propTasks.length > 0) setTasks(propTasks)
  }, [propTasks])

  const saveTasks = async (updated: Task[]) => {
    setSaving(true)
    try {
      await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
      onTasksChange?.(updated)
    } catch {}
    setSaving(false)
  }

  const updateStatus = (idx: number, st: TaskStatus) => {
    const updated = tasks.map((t, i) => i === idx ? { ...t, st } : t)
    setTasks(updated)
    saveTasks(updated)
  }

  const toggleDone = (idx: number) => {
    const t = tasks[idx]
    updateStatus(idx, t.st === 'done' ? 'doing' : 'done')
  }

  const filters = ['すべて', '未着手', '進行中', '対応待ち', '遅れあり', '完了']
  const filtered = filter === 'すべて' ? tasks : tasks.filter(t => statusLabel[t.st] === filter)

  const CW = 48

  return (
    <div>
      <style>{`
        .gantt-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-bottom: 0.5px solid var(--b1); background: #fafaf9; flex-wrap: wrap; gap: 8px; }
        .gf-wrap { display: flex; gap: 3px; }
        .gf { padding: 3px 9px; border-radius: 20px; border: 0.5px solid var(--b1); font-size: 11px; cursor: pointer; background: var(--paper); color: var(--muted); transition: background 0.1s; }
        .gf:hover { background: var(--bg); }
        .gf.on { background: var(--ink); color: #fff; border-color: var(--ink); }
        .gleg { display: flex; gap: 10px; flex-wrap: wrap; }
        .gli { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--muted); }
        .gld { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
        .g-scroll { overflow-x: auto; }
        .g-table { border-collapse: collapse; min-width: 100%; }
        .g-mrow th { padding: 5px 0; text-align: center; font-size: 10px; font-weight: 600; color: var(--ink2); background: #fafaf9; border-bottom: 0.5px solid var(--b1); }
        .g-wrow th { padding: 3px 0; text-align: center; font-size: 10px; color: var(--muted); background: #fafaf9; border-bottom: 0.5px solid var(--b1); white-space: pre; line-height: 1.3; }
        .g-wrow th.cw { background: #f0f0ef; color: var(--ink2); font-weight: 600; }
        .g-row td { border-bottom: 0.5px solid var(--b2); height: 36px; vertical-align: middle; padding: 0; }
        .g-row:last-child td { border-bottom: none; }
        .g-row:hover td { background: #fafaf9; }
        .g-row.done-row { opacity: 0.38; }
        .t-label { padding: 4px 10px; white-space: nowrap; position: sticky; left: 0; background: var(--paper); z-index: 10; min-width: 220px; max-width: 220px; border-right: 0.5px solid var(--b1); }
        .g-row:hover .t-label { background: #fafaf9; }
        .t-label-inner { display: flex; align-items: center; gap: 6px; }
        .t-check { width: 14px; height: 14px; border: 1.5px solid var(--b1); border-radius: 4px; flex-shrink: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #fff; transition: all 0.1s; }
        .t-check:hover { border-color: var(--ink2); }
        .t-check.done { background: var(--green); border-color: var(--green); }
        .s-tag { font-size: 10px; color: var(--ink2); background: #f0f0ef; padding: 1px 5px; border-radius: 3px; white-space: nowrap; flex-shrink: 0; }
        .t-name { font-size: 11px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px; color: var(--ink); }
        .delay-tag { font-size: 9px; color: var(--orange); background: var(--obg); padding: 1px 5px; border-radius: 3px; flex-shrink: 0; }
        .chg-tag { font-size: 9px; color: var(--orange); background: var(--obg); padding: 1px 5px; border-radius: 3px; flex-shrink: 0; }
        .g-cell { padding: 0 2px; }
        .g-cell.cw { background: rgba(0,0,0,0.02); }
        .bar-wrap { height: 22px; position: relative; }
        .bar { position: absolute; top: 50%; transform: translateY(-50%); height: 13px; border-radius: 3px; left: 2px; right: 2px; cursor: pointer; transition: opacity 0.1s; }
        .bar:hover { opacity: 0.75; }
        .chg-dot { position: absolute; top: 1px; right: 3px; width: 4px; height: 4px; background: var(--orange); border-radius: 50%; }
        .owner-cell { padding: 4px 8px; border-left: 0.5px solid var(--b1); }
        .action-cell { padding: 4px 6px; }
        .row-actions { display: flex; gap: 3px; }
        .st-sel { border: 0.5px solid var(--b1); border-radius: 3px; padding: 2px 4px; font-size: 10px; font-family: inherit; cursor: pointer; background: var(--paper); color: var(--ink2); }
        .saving-msg { font-size: 10px; color: var(--muted); }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="pg-sub" style={{ margin: 0 }}>遅れありはオレンジ、期日変更は●マークで識別</div>
        {saving && <span className="saving-msg">保存中...</span>}
      </div>

      <div className="cw">
        <div className="gantt-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="gf-wrap">
              {filters.map(f => (
                <div key={f} className={`gf${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{f}</div>
              ))}
            </div>
            <div className="gleg">
              {Object.entries(barColor).map(([st, color]) => (
                <div key={st} className="gli">
                  <div className="gld" style={{ background: color }} />
                  {statusLabel[st as TaskStatus]}
                </div>
              ))}
              <div className="gli">
                <div className="gld" style={{ background: 'var(--orange)', borderRadius: '50%', width: 6, height: 6 }} />
                期日変更
              </div>
            </div>
          </div>
        </div>

        <div className="g-scroll">
          <table className="g-table">
            <thead>
              <tr className="g-mrow">
                <th style={{ minWidth: 220, borderRight: '0.5px solid var(--b1)', position: 'sticky', left: 0, zIndex: 11, background: '#fafaf9' }}></th>
                {monthGroups.map(m => (
                  <th key={m.label} colSpan={m.count} style={{ borderLeft: '0.5px solid var(--b1)' }}>{m.label}</th>
                ))}
                <th style={{ minWidth: 80, borderLeft: '0.5px solid var(--b1)', background: '#fafaf9' }}>担当</th>
                <th style={{ minWidth: 72, background: '#fafaf9' }}>ステータス</th>
              </tr>
              <tr className="g-wrow">
                <th style={{ borderRight: '0.5px solid var(--b1)', position: 'sticky', left: 0, zIndex: 11, background: '#fafaf9' }}></th>
                {weeks.map((w, i) => (
                  <th key={i} className={i === currentWeekIdx ? 'cw' : ''} style={{ minWidth: CW }}>{w.label}</th>
                ))}
                <th style={{ borderLeft: '0.5px solid var(--b1)', background: '#fafaf9' }}></th>
                <th style={{ background: '#fafaf9' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => {
                const realIdx = tasks.indexOf(t)
                const si = weeks.findIndex(w => t.s <= w.end && t.e >= w.start)
                const ei = [...weeks].map((w, i) => ({ w, i })).reverse().find(({ w }) => t.s <= w.end && t.e >= w.start)?.i ?? -1

                return (
                  <tr key={`${t.施策}-${t.name}`} className={`g-row${t.st === 'done' ? ' done-row' : ''}`}>
                    <td className="t-label">
                      <div className="t-label-inner">
                        <div
                          className={`t-check${t.st === 'done' ? ' done' : ''}`}
                          onClick={() => toggleDone(realIdx)}
                        >
                          {t.st === 'done' ? '✓' : ''}
                        </div>
                        <span className="s-tag">{t.施策}</span>
                        <span className="t-name" title={t.name}>{t.name}</span>
                        {t.st === 'delayed' && <span className="delay-tag">遅れあり</span>}
                        {t.chg && <span className="chg-tag">変更</span>}
                      </div>
                    </td>
                    {weeks.map((w, wi) => {
                      const isCw = wi === currentWeekIdx
                      const hasBar = si !== -1 && wi >= si && wi <= ei
                      const isStart = wi === si
                      const isEnd = wi === ei
                      return (
                        <td key={wi} className={`g-cell${isCw ? ' cw' : ''}`} style={{ minWidth: CW }}>
                          {hasBar && (
                            <div className="bar-wrap">
                              <div
                                className="bar"
                                style={{
                                  background: barColor[t.st],
                                  left: isStart ? 4 : 0,
                                  right: isEnd ? 4 : 0,
                                  borderRadius: isStart && isEnd ? 3 : isStart ? '3px 0 0 3px' : isEnd ? '0 3px 3px 0' : 0,
                                }}
                                title={t.name}
                              >
                                {t.chg && isEnd && <div className="chg-dot" />}
                              </div>
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="owner-cell">
                      <span className={`ob ${ownerClass[t.own]}`}>{ownerLabel[t.own]}</span>
                    </td>
                    <td className="action-cell">
                      <select
                        className="st-sel"
                        value={t.st}
                        onChange={e => updateStatus(realIdx, e.target.value as TaskStatus)}
                      >
                        {Object.entries(statusLabel).map(([val, lbl]) => (
                          <option key={val} value={val}>{lbl}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
