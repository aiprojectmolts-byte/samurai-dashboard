'use client'

import React, { useState, useEffect } from 'react'

type TaskStatus = 'todo' | 'doing' | 'thread-review' | 'review' | 'done' | 'waiting' | 'delayed'

interface Task {
  id?: string
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
  備考?: string
  背景?: string
  背景ソース?: string
  phase?: string
  threadUrl?: string
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
  todo: '未着手', doing: '進行中', 'thread-review': 'スレッド確認中', review: '定例確認', done: '完了', waiting: '対応待ち', delayed: '遅れあり'
}

const ownerLabel = { molts: 'THE MOLTS', samurai: 'SAMURAI', both: '共同' }
const ownerClass = { molts: 'ob-m', samurai: 'ob-s', both: 'ob-b' }

const barColor: Record<TaskStatus, string> = {
  todo: '#b0b8c4',
  doing: '#f59e0b',
  'thread-review': '#8b5cf6',
  review: '#3b82f6',
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

// 改行を <br> に変換して表示（markdownライブラリは使わない）
const renderLines = (text: string) => text.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)

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
  const [agenda, setAgenda] = useState<string | null>(null)
  const [agendaDetail, setAgendaDetail] = useState<any | null>(null)
  const [agendaTab, setAgendaTab] = useState<'text' | 'detail'>('text')
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [agendaOpen, setAgendaOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [pastAgendas, setPastAgendas] = useState<any[]>([])
  const [expandedAgenda, setExpandedAgenda] = useState<number | null>(null)
  const [phases, setPhases] = useState<{ id: string; name: string; order: number }[]>([])
  const [expandedBg, setExpandedBg] = useState<Set<string>>(new Set())
  const toggleBg = (key: string) => setExpandedBg(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })

  useEffect(() => {
    if (propTasks && propTasks.length > 0) setTasks(propTasks)
  }, [propTasks])

  const loadPastAgendas = async () => {
    try {
      const res = await fetch('/api/agendas')
      const data = await res.json()
      if (Array.isArray(data)) setPastAgendas(data)
    } catch {}
  }

  useEffect(() => { loadPastAgendas() }, [])
  useEffect(() => {
    fetch('/api/phases').then(r => r.json()).then(d => { if (Array.isArray(d)) setPhases(d) }).catch(() => {})
  }, [])

  // フェーズ順 + 末尾に「未設定」。タスクの phase はフェーズID。未設定/不明は __none__
  const orderedPhases = [...phases].sort((a, b) => (a.order || 0) - (b.order || 0))
  const phaseMap = new Map(phases.map(p => [p.id, p]))
  const phaseKeyOf = (t: Task) => (t.phase && phaseMap.has(t.phase)) ? t.phase : '__none__'
  const phaseSlots: { key: string; name: string }[] = [
    ...orderedPhases.map(p => ({ key: p.id, name: p.name })),
    { key: '__none__', name: '未設定' },
  ]

  const updateStatus = (taskName: string, st: TaskStatus) => {
    const updated = tasks.map(t => t.name === taskName ? { ...t, st } : t)
    setTasks(updated)
    onTasksChange?.(updated)
  }

  const toggleDone = (taskName: string) => {
    const t = tasks.find(t => t.name === taskName)!
    updateStatus(taskName, t.st === 'done' ? 'doing' : 'done')
  }

  const deleteTask = (t: Task) => {
    if (!window.confirm(`このタスクを削除しますか？\n「${t.name}」`)) return
    const updated = tasks.filter(x => (x.id ?? x.name) !== (t.id ?? t.name))
    setTasks(updated)
    onTasksChange?.(updated)
  }

  const generateAgenda = async () => {
    setAgendaLoading(true)
    setCopied(false)
    setAgendaOpen(true)
    setConfirmed(false)
    setConfirmError('')
    try {
      // a. タスク一覧を取得
      const res = await fetch('/api/tasks')
      const fetched = await res.json().catch(() => [])
      const list: Task[] = Array.isArray(fetched) ? fetched : []

      // 期限フィールド e は 'YYYY-MM-DD' 文字列。文字列比較で日付を判定できる
      const today = new Date().toISOString().slice(0, 10)
      const cut7 = new Date(); cut7.setDate(cut7.getDate() + 7)
      const cutoff7 = cut7.toISOString().slice(0, 10)
      const owner = (t: Task) => t.assignee || ownerLabel[t.own]

      // b. 分類（完了以外をアクティブとして扱う）
      const activeTasks = list.filter(t => t.st !== 'done')
      const reviewTasks = list.filter(t => t.st === 'review')
      const threadTasks = list.filter(t => t.st === 'thread-review')
      const nextWeek = list.filter(t => t.st !== 'done' && t.e && t.e >= today && t.e <= cutoff7)

      // 前回確定アジェンダ（先頭1件）
      let prevAgenda = 'なし'
      try {
        const aRes = await fetch('/api/agendas')
        const aData = await aRes.json()
        if (Array.isArray(aData) && aData[0]?.content) prevAgenda = aData[0].content
      } catch {}

      if (activeTasks.length === 0 && prevAgenda === 'なし') {
        setAgenda('対象タスクがありません')
        setAgendaDetail(null)
        setAgendaLoading(false)
        return
      }

      const taskData = activeTasks.map(t => ({
        name: t.name, assignee: owner(t), 担当チーム: ownerLabel[t.own],
        施策: t.施策 || '未分類', status: statusLabel[t.st], 期限: t.e,
        背景: t.背景 || '', 備考: t.備考 || '', threadUrl: t.threadUrl || '',
      }))

      // 詳細タブ用の構造化データ（AIを呼ばずタスクから直接構築）
      const mkEntry = (t: Task) => ({ name: t.name, assignee: owner(t), status: statusLabel[t.st], st: t.st, 施策: t.施策 || '未分類', 背景: t.背景 || '', threadUrl: t.threadUrl || '', 期限: t.e })
      const categoryOrder: string[] = []
      const byCategory: Record<string, any[]> = {}
      activeTasks.forEach(t => {
        const c = t.施策 || '未分類'
        if (!byCategory[c]) { byCategory[c] = []; categoryOrder.push(c) }
        byCategory[c].push(mkEntry(t))
      })
      const decision = list.filter(t => t.st === 'review' || t.st === 'thread-review').map(mkEntry)
      setAgendaDetail({ prevAgenda, categoryOrder, byCategory, decision, nextWeek: nextWeek.map(mkEntry) })

      const prompt = `以下のタスクデータをもとに、週次定例MTGのシンプルなアジェンダを生成してください。

今日の日付：${today}
タスク一覧（JSON）：${JSON.stringify(taskData, null, 2)}
前回確定アジェンダ：${prevAgenda}

【重要】タスクの一覧を出力しないこと。
タスクを素材にして「その場で何をするか」という議題を作ること。

出力形式（プレーンテキストのみ・記号なし）：

📋 定例アジェンダ（${today}）
0. オープニング
1. 前回アクションの確認（前回アジェンダが「なし」の場合はこの項目を省略）
2. （施策領域ごとの議題を最大3〜4項目。例：「発信コンテンツの方向性確認」）
n. 課題・決定事項
n+1. 次週アクションの確認
n+2. クローズ

ルール：
・議題は最大7項目まで
・各項目は短く（15〜20文字以内）
・タスク名をそのまま使わない。「〜の確認」「〜の合意」「〜の共有」など行動ベースで書く
・通常進行中で課題がないものはまとめる（例：「発信コンテンツの進捗共有」）
・定例確認・スレッド確認中・遅延があるものは必ず議題に入れる
・プレーンテキストのみ。markdownや記号（#・*・-）は使わない`

      // c. Claude に送信
      const aiRes = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2500,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const aiData = await aiRes.json()
      const out = aiData.content?.[0]?.text || ''
      setAgenda(out || 'アジェンダの生成に失敗しました')
    } catch (e) {
      setAgenda('アジェンダの生成中にエラーが発生しました')
    }
    setAgendaLoading(false)
  }

  const copyAgenda = async () => {
    if (!agenda) return
    try {
      await navigator.clipboard.writeText(agenda)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  // 詳細タブ用のタスクカード（背景は折りたたみ）
  const renderAgendaCard = (it: any, key: string) => (
    <div key={key} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 6, padding: '8px 10px', marginBottom: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {it.st === 'review' && <span style={{ fontSize: 9, fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', padding: '1px 6px', borderRadius: 3 }}>定例確認</span>}
        {it.st === 'thread-review' && <span style={{ fontSize: 9, fontWeight: 600, color: '#6d28d9', background: '#f5f3ff', padding: '1px 6px', borderRadius: 3 }}>スレッド確認中</span>}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{it.name}</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{it.assignee} ・ {it.status}{it.期限 ? ` ・ ${it.期限}` : ''}</span>
        {it.threadUrl && <a href={it.threadUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: '#6d28d9', textDecoration: 'none', background: '#f5f3ff', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>🔗 スレッド</a>}
      </div>
      {it.背景 && (
        <div style={{ marginTop: 3 }}>
          <span onClick={() => toggleBg(key)} style={{ fontSize: 10, color: 'var(--muted)', cursor: 'pointer' }}>{expandedBg.has(key) ? '▼' : '▶'} 背景</span>
          {expandedBg.has(key) && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>{it.背景}</div>}
        </div>
      )}
    </div>
  )

  const confirmAgenda = async () => {
    if (!agenda || confirmed) return
    setConfirming(true)
    setConfirmError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch('/api/agendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `定例アジェンダ ${today}`,
          content: agenda,
          date: today,
          source: 'スケジュール画面から生成',
        })
      })
      if (!res.ok) throw new Error('save failed')
      setConfirmed(true)
      await loadPastAgendas()
    } catch (e) {
      setConfirmError('アジェンダの確定に失敗しました')
    }
    setConfirming(false)
  }

  const agendaNonContent = ['対象タスクがありません', 'アジェンダの生成に失敗しました', 'アジェンダの生成中にエラーが発生しました']
  const isRealAgenda = agenda !== null && !agendaNonContent.includes(agenda)

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
        .g-phase td { border-bottom: 0.5px solid var(--b1); border-top: 0.5px solid var(--b1); height: 30px; vertical-align: middle; padding: 0; background: #e7e7e4; }
        .g-phase .t-label { background: #e7e7e4; font-size: 11px; font-weight: 700; color: var(--ink); letter-spacing: 0.02em; }
        .g-phase .owner-cell, .g-phase .action-cell, .g-phase .phase-mid { background: #e7e7e4; }
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
        .owner-cell { padding: 4px 8px; border-left: 0.5px solid var(--b1); white-space: nowrap; position: sticky; right: 108px; z-index: 9; min-width: 80px; }
        .g-group .owner-cell { background: #fafaf9; }
        .g-row .owner-cell { background: var(--paper); }
        .g-row:hover .owner-cell { background: #fafaf9; }
        .action-cell { padding: 4px 6px; white-space: nowrap; position: sticky; right: 0; z-index: 9; border-left: 0.5px solid var(--b1); min-width: 108px; }
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
            {['all', 'doing', 'thread-review', 'review', 'waiting', 'delayed', 'todo', 'done'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} style={fbtn(filterStatus === s)}>
                {s === 'all' ? 'すべて' : s === 'doing' ? '進行中' : s === 'thread-review' ? 'スレッド確認中' : s === 'review' ? '定例確認' : s === 'waiting' ? '対応待ち' : s === 'delayed' ? '遅れあり' : s === 'todo' ? '未着手' : '完了'}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saving && <span style={{ fontSize: 10, color: 'var(--muted)' }}>保存中...</span>}
          <button onClick={generateAgenda} disabled={agendaLoading}
            style={{ padding: '6px 14px', background: agendaLoading ? 'var(--b1)' : 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 11, fontWeight: 600, cursor: agendaLoading ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {agendaLoading ? '生成中...' : '📋 アジェンダ生成'}
          </button>
        </div>
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
                <th style={{ minWidth: 80, borderLeft: '0.5px solid var(--b1)', background: '#fafaf9', position: 'sticky', right: 108, zIndex: 11 }}>担当</th>
                <th style={{ minWidth: 108, background: '#fafaf9', position: 'sticky', right: 0, zIndex: 11, borderLeft: '0.5px solid var(--b1)' }}>ステータス</th>
              </tr>
              <tr className="g-wrow">
                <th style={{ borderRight: '0.5px solid var(--b1)', position: 'sticky', left: 0, zIndex: 11, background: '#fafaf9' }}></th>
                {weeks.map((w, i) => (
                  <th key={i} className={i === currentWeekIdx ? 'cw' : ''} style={{ minWidth: CW }}>{w.label}</th>
                ))}
                <th style={{ borderLeft: '0.5px solid var(--b1)', background: '#fafaf9', position: 'sticky', right: 108, zIndex: 11 }}></th>
                <th style={{ background: '#fafaf9', position: 'sticky', right: 0, zIndex: 11, borderLeft: '0.5px solid var(--b1)' }}></th>
              </tr>
            </thead>
            <tbody>
              {phaseSlots.map(ph => {
                const phaseTasks = filteredTasks.filter(t => phaseKeyOf(t) === ph.key)
                if (phaseTasks.length === 0) return null
                const sakus = buildGroups(phaseTasks)
                return (
                  <React.Fragment key={"phase-" + ph.key}>
                    {/* フェーズ区切り行 */}
                    <tr className="g-phase">
                      <td className="t-label">{ph.name}</td>
                      <td className="phase-mid" colSpan={weeks.length}></td>
                      <td className="owner-cell"></td>
                      <td className="action-cell"></td>
                    </tr>

                    {sakus.map(施策 => {
                      const groupTasks = phaseTasks.filter(t => t.施策 === 施策)
                      const groupS = groupTasks.reduce((min, t) => t.s < min ? t.s : min, groupTasks[0].s)
                      const groupE = groupTasks.reduce((max, t) => t.e > max ? t.e : max, groupTasks[0].e)
                      const groupSt = groupTasks.reduce((worst, t) => {
                        const p: Record<TaskStatus, number> = { waiting: 7, delayed: 6, doing: 5, 'thread-review': 4, review: 3, todo: 2, done: 1 }
                        return p[t.st] > p[worst] ? t.st : worst
                      }, 'done' as TaskStatus)

                      return (
                        <React.Fragment key={"group-" + ph.key + "-" + 施策}>
                          {/* 施策グループ区切り行 */}
                          <tr className="g-group">
                            <td className="t-label">{施策}</td>
                            {renderBarCells(groupS, groupE, groupSt, false, true)}
                            <td className="owner-cell"></td>
                            <td className="action-cell"></td>
                          </tr>

                          {/* 子タスク行 */}
                          {groupTasks.map(t => {
                            const k = t.id ?? t.name
                            return (
                              <tr key={k} className={`g-row${t.st === 'done' ? ' done-row' : ''}`}>
                                <td className="t-label">
                                  <div className="row-inner">
                                    <div className={`t-check${t.st === 'done' ? ' done' : ''}`} onClick={() => toggleDone(t.name)}>
                                      {t.st === 'done' ? '✓' : ''}
                                    </div>
                                    <span className="t-name" title={t.name} onClick={() => onEditTask?.(t)} style={{cursor:"pointer"}}>{t.name}</span>
                                    {t.st === 'delayed' && <span className="delay-tag">遅れあり</span>}
                                    {t.chg && <span className="delay-tag">変更</span>}
                                    {t.st === 'thread-review' && t.threadUrl && <a href={t.threadUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 9, background: '#f5f3ff', color: '#6d28d9', padding: '1px 5px', borderRadius: 3, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>🔗 スレッド</a>}
                                  </div>
                                  {t.背景 && (
                                    <div style={{ paddingLeft: 32, marginTop: 2 }}>
                                      <span onClick={() => toggleBg(k)} style={{ fontSize: 9, color: 'var(--muted)', cursor: 'pointer' }}>{expandedBg.has(k) ? '▼' : '▶'} 背景・追加経緯</span>
                                      {expandedBg.has(k) && (
                                        <div style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'normal', lineHeight: 1.4, marginTop: 2 }}>背景：{t.背景}{t.背景ソース ? `（${t.背景ソース}）` : ''}</div>
                                      )}
                                    </div>
                                  )}
                                </td>
                                {renderBarCells(t.s, t.e, t.st, t.chg)}
                                <td className="owner-cell">
                                  <span className={`ob ${ownerClass[t.own]}`}>{t.assignee || ownerLabel[t.own]}</span>
                                </td>
                                <td className="action-cell">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <select className="st-sel" value={t.st} onChange={e => updateStatus(t.name, e.target.value as TaskStatus)}>
                                      {Object.entries(statusLabel).map(([val, lbl]) => (
                                        <option key={val} value={val}>{lbl}</option>
                                      ))}
                                    </select>
                                    <button onClick={() => deleteTask(t)} title="削除" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '0 2px', color: 'var(--muted)', flexShrink: 0 }}>🗑</button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {agenda !== null && (
        <div className="cw" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: agendaOpen ? '0.5px solid var(--b1)' : 'none', background: '#fafaf9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setAgendaOpen(o => !o)}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{agendaOpen ? '▼' : '▶'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>週次定例アジェンダ</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={copyAgenda}
                style={{ padding: '4px 10px', background: copied ? 'var(--gbg)' : 'none', border: '0.5px solid ' + (copied ? 'var(--green)' : 'var(--b1)'), borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: copied ? 'var(--green)' : 'var(--ink2)' }}>
                {copied ? '✓ コピーしました' : '📋 コピー'}
              </button>
              {isRealAgenda && (
                <button onClick={confirmAgenda} disabled={confirmed || confirming}
                  style={{ padding: '4px 10px', background: confirmed ? 'var(--gbg)' : 'var(--ink)', border: '0.5px solid ' + (confirmed ? 'var(--green)' : 'var(--ink)'), borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: (confirmed || confirming) ? 'default' : 'pointer', fontFamily: 'inherit', color: confirmed ? 'var(--green)' : '#fff', whiteSpace: 'nowrap' }}>
                  {confirmed ? '✓ 確定済み' : confirming ? '確定中...' : '✓ このアジェンダを確定する'}
                </button>
              )}
            </div>
          </div>
          {confirmError && <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--red)' }}>{confirmError}</div>}
          {agendaOpen && (
            <div>
              {isRealAgenda && (
                <div style={{ display: 'flex', gap: 6, padding: '10px 14px 0' }}>
                  {(['text', 'detail'] as const).map(tab => (
                    <button key={tab} onClick={() => setAgendaTab(tab)}
                      style={{ padding: '3px 12px', borderRadius: 20, border: '0.5px solid var(--b1)', background: agendaTab === tab ? 'var(--ink)' : 'none', color: agendaTab === tab ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
                      {tab === 'text' ? 'テキスト' : '詳細'}
                    </button>
                  ))}
                </div>
              )}
              {(!isRealAgenda || agendaTab === 'text') ? (
                <div style={{ padding: '14px 16px', fontSize: 12, lineHeight: 1.7, color: 'var(--ink)', fontFamily: 'inherit' }}>{renderLines(agenda)}</div>
              ) : agendaDetail ? (
                <div style={{ padding: '12px 14px' }}>
                  {/* 1. 前回アクションの確認 */}
                  {agendaDetail.prevAgenda && agendaDetail.prevAgenda !== 'なし' && (
                    <div style={{ marginBottom: 14 }}>
                      <div className="sh" style={{ marginBottom: 6 }}>1. 前回アクションの確認</div>
                      <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 6, padding: '10px 12px', fontSize: 11, lineHeight: 1.7, color: 'var(--ink2)', whiteSpace: 'pre-wrap' as const }}>{agendaDetail.prevAgenda}</div>
                    </div>
                  )}

                  {/* 2. 施策別タスク一覧 */}
                  <div style={{ marginBottom: 14 }}>
                    <div className="sh" style={{ marginBottom: 6 }}>2. 施策別タスク一覧</div>
                    {agendaDetail.categoryOrder.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>アクティブなタスクはありません</div>}
                    {agendaDetail.categoryOrder.map((c: string) => (
                      <div key={c} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', marginBottom: 4 }}>{c}</div>
                        {agendaDetail.byCategory[c].map((it: any, i: number) => renderAgendaCard(it, `cat-${c}-${i}`))}
                      </div>
                    ))}
                  </div>

                  {/* 3. 課題・意思決定事項 */}
                  {agendaDetail.decision.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div className="sh" style={{ marginBottom: 6 }}>3. 課題・意思決定事項</div>
                      {agendaDetail.decision.map((it: any, i: number) => renderAgendaCard(it, `dec-${i}`))}
                    </div>
                  )}

                  {/* 4. 次週アクション */}
                  {agendaDetail.nextWeek.length > 0 && (
                    <div>
                      <div className="sh" style={{ marginBottom: 6 }}>4. 次週アクション（7日以内）</div>
                      {agendaDetail.nextWeek.map((it: any, i: number) => renderAgendaCard(it, `nw-${i}`))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--muted)' }}>詳細データがありません</div>
              )}
            </div>
          )}
        </div>
      )}

      {pastAgendas.length > 0 && (
        <div className="cw" style={{ marginTop: 12 }}>
          <div style={{ padding: '8px 14px', borderBottom: '0.5px solid var(--b1)', background: '#fafaf9', fontSize: 11, fontWeight: 600, color: 'var(--ink2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>過去の確定アジェンダ</div>
          {pastAgendas.slice(0, 5).map((a: any) => (
            <div key={a.id} style={{ borderBottom: '0.5px solid var(--b2)' }}>
              <div onClick={() => setExpandedAgenda(e => e === a.id ? null : a.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{expandedAgenda === a.id ? '▼' : '▶'}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 80 }}>{a.date}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{a.title}</span>
              </div>
              {expandedAgenda === a.id && (
                <div style={{ padding: '0 16px 14px', fontSize: 12, lineHeight: 1.7, color: 'var(--ink)', fontFamily: 'inherit' }}>{renderLines(a.content)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
