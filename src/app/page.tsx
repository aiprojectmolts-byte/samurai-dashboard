'use client'
import KpiView from './KpiView'
import TrendChart from './TrendChart'
import GanttView from './GanttView'
import TaskTracker from './TaskTracker'
import QuestionsView from './QuestionsView'
import SlackLogView from './SlackLogView'
import TaskModal from './TaskModal'
import MtgImport from './MtgImport'
import ContentGen from './ContentGen'
import Knowledge from './Knowledge'
import Competitors from './Competitors'

import { useState, useEffect } from 'react'

type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'waiting' | 'delayed'

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
  備考?: string
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
  todo: '未着手', doing: '進行中', review: '定例確認', done: '完了', waiting: '対応待ち', delayed: '遅れあり'
}

const ownerLabel = { molts: 'THE MOLTS', samurai: 'SAMURAI', both: '共同' }
const ownerClass = { molts: 'ob-m', samurai: 'ob-s', both: 'ob-b' }

export default function Dashboard() {
  const [view, setViewRaw] = useState('home')
  const setView = (v: string) => { setViewRaw(v); if (v === 'home') fetch('/api/kpi').then(r => r.json()).then(data => { if (data && Object.keys(data).length > 0) setKpi((k: typeof kpi) => ({...k, ...data})) }).catch(() => {}) }
  const [tasks, setTasks] = useState<Task[]>(defaultTasks)
  const [saving, setSaving] = useState(false)
  const [kpi, setKpi] = useState({
    visioalCvr: 3.2, xImpression: 18.4, noteViews: 4820,
    referralCount: 3, referralInquiry: 1, kgiTotal: 12, kgiPrev: 9, kgiRendery: 4, kgiRenderyPrev: 3, kgiKnock: 5, kgiKnockPrev: 3, kgiVisioal: 2, kgiVisioalPrev: 2, kgiCustom: 1, kgiCustomPrev: 2
  })
  const [modalTask, setModalTask] = useState<Task | null | undefined>(undefined)
  const [members, setMembers] = useState<{ samurai: string[], molts: string[] }>({ samurai: ['加藤', '髙山', '川島', '横溝', 'その他'], molts: ['海老澤', '本村', 'その他'] })
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/kpi')
      .then(r => r.json())
      .then(data => { if (data && Object.keys(data).length > 0) setKpi(k => ({...k, ...data})) })
      .catch(() => {})
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setTasks(data) })
      .catch(() => {})
  }, [])

  const updateTaskStatus = async (idx: number, st: TaskStatus) => {
    const updated = tasks.map((t, i) => i === idx ? { ...t, st } : t)
    setTasks(updated)
    setSaving(true)
    try {
      await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
      const now = new Date()
      setLastSaved(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
    } catch {}
    setSaving(false)
  }

  const saveTask = async (task: Task, isNew: boolean) => {
    let updated: Task[]
    if (isNew) {
      updated = [...tasks, task]
    } else {
      updated = tasks.map(t => t.name === task.name ? task : t)
    }
    setTasks(updated)
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
  }

  const deleteTask = async (task: Task) => {
    const updated = tasks.filter(t => t.name !== task.name)
    setTasks(updated)
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
  }

  useEffect(() => { fetch('/api/members').then(r => r.json()).then(data => setMembers(data)).catch(() => {}) }, [])

  const waiting = tasks.filter(t => t.st === 'waiting')
  const delayed = tasks.filter(t => t.st === 'delayed')
  const review = tasks.filter(t => t.st === 'review')
  const doing = tasks.filter(t => t.st === 'doing')
  const done = tasks.filter(t => t.st === 'done')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        :root {
          --bg: #f4f4f2; --paper: #ffffff;
          --b1: rgba(0,0,0,0.08); --b2: rgba(0,0,0,0.05);
          --ink: #0f0f0f; --ink2: #3f3f3f; --muted: #8c8c8c;
          --green: #16a34a; --gbg: #f0fdf4;
          --red: #dc2626; --rbg: #fef2f2;
          --orange: #c2410c; --obg: #fff7ed;
          --yellow: #b45309; --ybg: #fffbeb;
          --r: 6px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter','Noto Sans JP',sans-serif; background: var(--bg); color: var(--ink); font-size: 12px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
        .hd { height: 48px; background: var(--paper); border-bottom: 0.5px solid var(--b1); display: flex; align-items: center; justify-content: space-between; padding: 0 18px; position: sticky; top: 0; z-index: 100; }
        .hd-logo { font-size: 12px; font-weight: 600; letter-spacing: -0.01em; }
        .hd-div { width: 1px; height: 14px; background: var(--b1); margin: 0 10px; }
        .hd-proj { font-size: 12px; color: var(--muted); }
        .hd-r { display: flex; align-items: center; gap: 8px; }
        .hd-kgi { font-size: 11px; color: var(--yellow); background: var(--ybg); border: 0.5px solid #fde68a; border-radius: 20px; padding: 2px 10px; }
        .mock-pill { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: #fff; background: var(--red); border-radius: 4px; padding: 2px 6px; }
        .layout { display: flex; height: calc(100vh - 48px); }
        .sb { width: 184px; background: var(--paper); border-right: 0.5px solid var(--b1); flex-shrink: 0; overflow-y: auto; }
        .sb-top { padding: 16px 14px 12px; border-bottom: 0.5px solid var(--b2); }
        .sb-name { font-size: 12px; font-weight: 600; letter-spacing: -0.01em; }
        .sb-sub { font-size: 10px; color: var(--muted); margin-top: 1px; }
        .sb-grp { padding: 12px 10px 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
        .ni { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; margin: 1px 4px; border-radius: var(--r); cursor: pointer; font-size: 12px; color: var(--ink2); transition: background 0.1s; }
        .ni:hover { background: var(--bg); }
        .ni.on { background: #f0f0ef; color: var(--ink); font-weight: 500; }
        .sb-div { height: 0.5px; background: var(--b2); margin: 5px 0; }
        .nb { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; line-height: 1.4; }
        .nb-r { background: var(--rbg); color: var(--red); }
        .nb-o { background: var(--obg); color: var(--orange); }
        .nb-bl { background: #eff6ff; color: #1d4ed8; }
        .main { flex: 1; overflow-y: auto; }
        .pg { padding: 20px 22px 40px; max-width: 1160px; }
        .pg-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 2px; }
        .pg-sub { font-size: 11px; color: var(--muted); margin-bottom: 18px; }
        .sh { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 8px; margin: 18px 0 8px; }
        .sh::after { content: ''; flex: 1; height: 0.5px; background: var(--b1); }
        .chip { display: inline-flex; align-items: center; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 20px; line-height: 1.4; }
        .cg { background: var(--gbg); color: var(--green); }
        .cr { background: var(--rbg); color: var(--red); }
        .co { background: var(--obg); color: var(--orange); }
        .cy { background: var(--ybg); color: var(--yellow); }
        .cn { background: #f4f4f2; color: var(--muted); border: 0.5px solid var(--b1); }
        .cb { background: #eff6ff; color: #1d4ed8; }
        .kgi-card { background: var(--paper); border: 0.5px solid var(--b1); border-radius: var(--r); padding: 16px 20px; margin-bottom: 12px; }
        .kgi-ey { font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
        .kgi-v { font-size: 44px; font-weight: 700; color: var(--ink); letter-spacing: -0.05em; line-height: 1; }
        .stat-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; margin-bottom: 12px; }
        .sc { background: var(--paper); border: 0.5px solid var(--b1); border-radius: var(--r); padding: 12px 14px; }
        .sc-ey { font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
        .sc-v { font-size: 32px; font-weight: 700; letter-spacing: -0.04em; line-height: 1; }
        .sc-sub { font-size: 11px; color: var(--muted); margin-top: 5px; display: flex; align-items: center; gap: 5px; }
        .cw { background: var(--paper); border: 0.5px solid var(--b1); border-radius: var(--r); overflow: hidden; margin-bottom: 10px; }
        table.tbl { width: 100%; border-collapse: collapse; }
        .tbl th { padding: 7px 14px; background: #fafaf9; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); text-align: left; border-bottom: 0.5px solid var(--b1); }
        .tbl td { padding: 11px 14px; border-bottom: 0.5px solid var(--b2); font-size: 12px; vertical-align: middle; }
        .tbl tr:last-child td { border-bottom: none; }
        .tbl tr:hover td { background: #fafaf9; }
        .ih { padding: 8px 14px; background: #fafaf9; border-bottom: 0.5px solid var(--b1); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 7px; }
        .ir { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-bottom: 0.5px solid var(--b2); }
        .ir:last-child { border-bottom: none; }
        .ir:hover { background: #fafaf9; }
        .il { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; white-space: nowrap; flex-shrink: 0; margin-top: 1px; }
        .il-w { background: var(--rbg); color: var(--red); }
        .il-d { background: var(--obg); color: var(--orange); }
        .il-y { background: var(--ybg); color: var(--yellow); }
        .il-g { background: var(--gbg); color: var(--green); }
        .il-bl { background: #eff6ff; color: #1d4ed8; }
        .ib { flex: 1; }
        .it { font-size: 13px; font-weight: 500; line-height: 1.35; }
        .id { font-size: 11px; color: var(--muted); margin-top: 3px; line-height: 1.4; }
        .im { display: flex; align-items: center; gap: 5px; margin-top: 4px; flex-wrap: wrap; }
        .stag { font-size: 10px; color: var(--ink2); background: #f0f0ef; padding: 1px 6px; border-radius: 4px; }
        .ctag { font-size: 10px; color: var(--orange); background: var(--obg); padding: 1px 6px; border-radius: 4px; }
        .ob { font-size: 10px; font-weight: 500; padding: 2px 7px; border-radius: 10px; }
        .ob-m { background: #f0f0ef; color: var(--ink2); }
        .ob-s { background: var(--ybg); color: #7c4f00; }
        .ob-b { background: var(--gbg); color: var(--green); }
        .tg { display: grid; grid-template-columns: repeat(auto-fill,minmax(220px,1fr)); gap: 7px; }
        .tc { background: var(--paper); border: 0.5px solid var(--b1); border-radius: var(--r); padding: 10px 12px; display: flex; align-items: flex-start; gap: 9px; }
        .tc.tb { border-left: 2px solid var(--red); }
        .tc.td2 { border-left: 2px solid var(--orange); }
        .tck { width: 14px; height: 14px; border: 1.5px solid var(--b1); border-radius: 4px; flex-shrink: 0; margin-top: 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #fff; transition: all 0.1s; }
        .tck.done { background: var(--green); border-color: var(--green); }
        .tck:hover { border-color: var(--ink2); }
        .tbody2 { flex: 1; }
        .tname { font-size: 13px; font-weight: 500; line-height: 1.35; }
        .talert { font-size: 10px; margin-top: 2px; }
        .talert.b { color: var(--red); }
        .talert.d { color: var(--orange); }
        .tmeta { display: flex; align-items: center; gap: 5px; margin-top: 4px; flex-wrap: wrap; }
        .tdue { font-size: 10px; font-weight: 500; }
        .due-n { color: var(--yellow); }
        .due-l { color: var(--orange); }
        .st-sel { border: 0.5px solid var(--b1); border-radius: 3px; padding: 2px 5px; font-size: 10px; font-family: inherit; cursor: pointer; }
        .saved-msg { font-size: 10px; color: var(--green); }
      `}</style>

      <header className="hd">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="hd-logo">SAMURAI × THE MOLTS</span>
          <span className="hd-div" />
          <span className="hd-proj">マーケティングプロジェクト</span>
        </div>
        <div className="hd-r">
          {saving && <span style={{ fontSize: 10, color: 'var(--muted)' }}>保存中...</span>}
          {lastSaved && !saving && <span className="saved-msg">✓ {lastSaved} 保存済み</span>}
          
        </div>
      </header>

      <div className="layout">
        <aside className="sb">
          <div className="sb-top">
            <div className="sb-name">SAMURAI ARCHITECTS</div>
            <div className="sb-sub">2026年6月 — 2027年5月</div>
          </div>
          <div className="sb-grp">概要</div>
          <div className={`ni${view === 'home' ? ' on' : ''}`} onClick={() => setView('home')}>ホーム</div>
          <div className={`ni${view === 'kpi' ? ' on' : ''}`} onClick={() => setView('kpi')}>KPI</div>
          <div className="sb-div" />
          <div className="sb-grp">プロジェクト</div>
          <div className={`ni${view === 'schedule' ? ' on' : ''}`} onClick={() => setView('schedule')}>
            スケジュール <span className="nb nb-o">{delayed.length}遅延</span>
          </div>
          <div className={`ni${view === 'tasks' ? ' on' : ''}`} onClick={() => setView('tasks')}>
            タスクトラッカー <span style={{ display: 'flex', gap: 4 }}><span className="nb nb-r">{waiting.length}件</span>{review.length > 0 && <span className="nb nb-bl">{review.length}定例</span>}</span>
          </div>
<div className={`ni${view === 'questions' ? ' on' : ''}`} onClick={() => setView('questions')}>質問シート</div>
          <div className="sb-div" />
          <div className="sb-grp">設定</div>
          <div className={`ni${view === 'settings' ? ' on' : ''}`} onClick={() => setView('settings')}>データ連携</div>
          <div className={`ni${view === 'mtg-import' ? ' on' : ''}
            {view === 'members' ? ' on' : ''}`} onClick={() => setView('members')}>メンバー管理</div>
          <div className={`ni${view === 'slack' ? ' on' : ''}`} onClick={() => setView('slack')}>コミュニケーションログ</div>
          <div className={`ni${view === 'mtg-import' ? ' on' : ''}`} onClick={() => setView('mtg-import')}>MTGデータ取り込み</div>
          <div className={`ni${view === 'content-gen' ? ' on' : ''}`} onClick={() => setView('content-gen')}>発信コンテンツ生成</div>
          <div className={`ni${view === 'knowledge' ? ' on' : ''}`} onClick={() => setView('knowledge')}>ナレッジベース</div>
          <div className={`ni${view === 'competitors' ? ' on' : ''}`} onClick={() => setView('competitors')}>競合情報</div>
        </aside>

        <main className="main">
          <div className="pg">

            {/* ホーム */}
            {view === 'home' && (
              <div>
                <div className="pg-title">ホーム</div>
                <div className="pg-sub">フェーズ1 進行中 — 2026年6月〜8月</div>

                <div className="kgi-card">
                  <div className="kgi-ey">案件相談数 — 今月合計</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                    <span className="kgi-v">{kpi.kgiTotal}</span>
                    <span className="chip cg">+3 先月比</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    {[['Rendery', kpi.kgiRendery, kpi.kgiRendery - kpi.kgiRenderyPrev],['knock knock AI', kpi.kgiKnock, kpi.kgiKnock - kpi.kgiKnockPrev],['VISIOAL', kpi.kgiVisioal, kpi.kgiVisioal - kpi.kgiVisioalPrev],['カスタム', kpi.kgiCustom, kpi.kgiCustom - kpi.kgiCustomPrev]].map(([label, val, diff]) => { const cls = (diff as number) > 0 ? 'cg' : (diff as number) < 0 ? 'cr' : 'cn'; const diffStr = (diff as number) > 0 ? '+' + diff : diff === 0 ? '±0' : String(diff); return (
                      <div key={label} style={{ background: 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>{val}</div>
                        <span className={`chip ${cls}`}>{diffStr}</span>
                      </div>
                    )})}
                  </div>
                </div>
                <TrendChart compact={true} />

                {(waiting.length > 0 || delayed.length > 0) && (
                  <div onClick={() => setView('tasks')} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--rbg)',border:'0.5px solid var(--red)',borderRadius:'var(--r)',padding:'10px 14px',marginBottom:10,cursor:'pointer'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      {waiting.length > 0 && <span style={{fontSize:12,color:'var(--red)',fontWeight:600}}>対応待ち {waiting.length}件</span>}
                      {delayed.length > 0 && <span style={{fontSize:12,color:'var(--orange)',fontWeight:600}}>遅れあり {delayed.length}件</span>}
                    </div>
                    <span style={{fontSize:11,color:'var(--muted)'}}>タスクトラッカーを見る →</span>
                  </div>
                )}

                <div className="stat-grid">
                  <div className="sc"><div className="sc-ey">VISIOAL LP CVR</div><div className="sc-v">{kpi.visioalCvr}<span style={{ fontSize: 13, fontWeight: 400 }}>%</span></div><div className="sc-sub">GA4</div></div>
                  <div className="sc"><div className="sc-ey">X インプレッション</div><div className="sc-v" style={{ fontSize: 22 }}>{kpi.xImpression}K</div><div className="sc-sub">週次</div></div>
                  <div className="sc"><div className="sc-ey">note 閲覧数</div><div className="sc-v" style={{ fontSize: 22 }}>{kpi.noteViews.toLocaleString()}</div><div className="sc-sub">累計</div></div>
                  <div className="sc"><div className="sc-ey">リファラル声がけ</div><div className="sc-v">{kpi.referralCount}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>件</span></div><div className="sc-sub">紹介経由 {kpi.referralInquiry}件</div></div>

                </div>

                <div className="sh">フェーズ進捗</div>
                <div className="cw">
                  <table className="tbl">
                    <thead><tr><th>フェーズ</th><th>内容</th><th>期間</th><th>ステータス</th></tr></thead>
                    <tbody>
                      <tr><td><strong>Phase 0</strong></td><td>ヒアリング・計測基盤構築・設計書承認</td><td style={{ color: 'var(--muted)', fontSize: 10 }}>〜2026年6月第1週</td><td><span className="chip cg">完了</span></td></tr>
                      <tr><td><strong>Phase 1</strong></td><td>事例数値化・VISIOAL LP・LP改修・CEO発信・リファラル</td><td style={{ color: 'var(--muted)', fontSize: 10 }}>2026年6月〜8月</td><td><span className="chip cy">進行中</span></td></tr>
                      <tr><td><strong>Phase 2</strong></td><td>リファラル制度設計・継続発信・計測改善</td><td style={{ color: 'var(--muted)', fontSize: 10 }}>2026年9月〜11月</td><td><span className="chip cn">未着手</span></td></tr>
                      <tr><td><strong>Phase 3</strong></td><td>継続・検証・最終評価</td><td style={{ color: 'var(--muted)', fontSize: 10 }}>2026年12月〜2027年5月</td><td><span className="chip cn">未着手</span></td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="sh">対応待ち・遅れあり</div>
                <div className="cw">
                  <div className="ih" style={{ color: 'var(--red)' }}>対応待ち <span className="nb nb-r">{waiting.length}</span></div>
                  {waiting.map((t, i) => (
                    <div className="ir" key={i}>
                      <span className="il il-w">対応待ち</span>
                      <div className="ib">
                        <div className="it" style={{cursor:"pointer"}} onClick={()=>setModalTask(t)}>{t.name}</div>
                        <div className="im"><span className="stag">{t.施策}</span><span className={`ob ${ownerClass[t.own]}`}>{ownerLabel[t.own]}</span></div>
                      </div>
                    </div>
                  ))}
                  {delayed.length > 0 && <div className="ih" style={{ color: 'var(--orange)' }}>遅れあり <span className="nb nb-o">{delayed.length}</span></div>}
                  {delayed.map((t, i) => (
                    <div className="ir" key={i}>
                      <span className="il il-d">遅れあり</span>
                      <div className="ib">
                        <div className="it" style={{cursor:"pointer"}} onClick={()=>setModalTask(t)}>{t.name}</div>
                        <div className="im"><span className="stag">{t.施策}</span><span className={`ob ${ownerClass[t.own]}`}>{ownerLabel[t.own]}</span>{t.chg && <span className="ctag">期日変更あり</span>}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {review.length > 0 && (
                  <>
                    <div className="sh">定例確認</div>
                    <div className="cw">
                      <div className="ih" style={{ color: '#1d4ed8' }}>定例確認 <span className="nb nb-bl">{review.length}</span></div>
                      {review.map((t, i) => (
                        <div className="ir" key={i}>
                          <span className="il il-bl">定例確認</span>
                          <div className="ib">
                            <div className="it" style={{cursor:"pointer"}} onClick={()=>setModalTask(t)}>{t.name}</div>
                            <div className="im"><span className="stag">{t.施策}</span><span className={`ob ${ownerClass[t.own]}`}>{ownerLabel[t.own]}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="sh">今週のアクション</div>
                <div className="tg">
                  {tasks.filter(t => t.st !== 'done' && t.st !== 'todo').slice(0, 4).map((t, i) => (
                    <div key={i} className={`tc${t.st === 'waiting' ? ' tb' : t.st === 'delayed' ? ' td2' : ''}`}>
                      <div className={`tck${t.st === 'done' ? ' done' : ''}`} onClick={() => updateTaskStatus(tasks.indexOf(t), t.st === 'done' ? 'doing' : 'done')}>{t.st === 'done' ? '✓' : ''}</div>
                      <div className="tbody2">
                        <span className="stag" style={{ display: 'inline-block', marginBottom: 3 }}>{t.施策}</span>
                        <div className="tname">{t.name}</div>
                        {t.st === 'waiting' && <div className="talert b">対応待ち</div>}
                        {t.st === 'delayed' && <div className="talert d">遅れあり</div>}
                        {t.st === 'review' && <div className="talert" style={{ color: '#1d4ed8' }}>定例確認</div>}
                        <div className="tmeta"><span className={`ob ${ownerClass[t.own]}`}>{ownerLabel[t.own]}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* タスクトラッカー */}
            {view === 'tasks' && <TaskTracker tasks={tasks} members={members} onStatusChange={(idx, st) => updateTaskStatus(idx, st as any)} onOpenModal={(t) => setModalTask(t)} />}
            {view === 'kpi' && <KpiView />}
            {view === 'settings' && (
              <div>
                <div className="pg-title">データ連携</div>
                <div className="pg-sub">各KPIのデータ取得方法を設定する</div>
              
                <div className="cw" style={{marginBottom:10}}>
                  <div className="ih">GA4 — Google Analytics 4 <span style={{marginLeft:'auto',fontSize:10,color:'var(--yellow)',background:'var(--ybg)',padding:'2px 8px',borderRadius:20}}>設定待ち</span></div>
                  <div style={{padding:'16px'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                      <div><div style={{fontSize:11,fontWeight:500,color:'var(--ink2)',marginBottom:5}}>測定ID</div><input type="text" placeholder="G-XXXXXXXXXX" style={{width:'100%',border:'0.5px solid var(--b1)',borderRadius:'var(--r)',padding:'8px 10px',fontSize:12,fontFamily:'inherit',background:'var(--bg)',outline:'none'}}/></div>
                      <div><div style={{fontSize:11,fontWeight:500,color:'var(--ink2)',marginBottom:5}}>プロパティID</div><input type="text" placeholder="123456789" style={{width:'100%',border:'0.5px solid var(--b1)',borderRadius:'var(--r)',padding:'8px 10px',fontSize:12,fontFamily:'inherit',background:'var(--bg)',outline:'none'}}/></div>
                    </div>
                    <div style={{fontSize:11,fontWeight:500,color:'var(--ink2)',marginBottom:5}}>サービスアカウント JSONキー</div>
                    <div style={{border:'0.5px dashed var(--b1)',borderRadius:'var(--r)',padding:'20px',textAlign:'center',background:'var(--bg)',cursor:'pointer'}}>
                      <div style={{fontSize:12,fontWeight:500,color:'var(--ink2)',marginBottom:4}}>JSONファイルをアップロード</div>
                      <div style={{fontSize:10,color:'var(--muted)'}}>クリックしてファイルを選択</div>
                    </div>
                  </div>
                </div>
                <div className="cw" style={{marginBottom:10}}>
                  <div className="ih">X — インプレッション（CSVアップロード）<span style={{marginLeft:'auto',fontSize:10,color:'var(--muted)',background:'#f0f0ef',padding:'2px 8px',borderRadius:20}}>手動運用</span></div>
                  <div style={{padding:'16px'}}>
                    <div style={{fontSize:11,fontWeight:500,color:'var(--ink2)',marginBottom:5}}>CSVファイル（週次アップロード）</div>
                    <div style={{border:'0.5px dashed var(--b1)',borderRadius:'var(--r)',padding:'20px',textAlign:'center',background:'var(--bg)',cursor:'pointer',marginBottom:12}}>
                      <div style={{fontSize:12,fontWeight:500,color:'var(--ink2)',marginBottom:4}}>CSVファイルをアップロード</div>
                      <div style={{fontSize:10,color:'var(--muted)'}}>Xアナリティクス → エクスポート → ツイートアクティビティのCSV</div>
                    </div>
                    <div><div style={{fontSize:11,fontWeight:500,color:'var(--ink2)',marginBottom:5}}>Xアカウント名</div><input type="text" placeholder="@SAMURAI_ARCHI" style={{width:'100%',border:'0.5px solid var(--b1)',borderRadius:'var(--r)',padding:'8px 10px',fontSize:12,fontFamily:'inherit',background:'var(--bg)',outline:'none'}}/></div>
                  </div>
                </div>
                <div className="cw" style={{marginBottom:10}}>
                  <div className="ih">Slack — 問い合わせ数カウント <span style={{marginLeft:'auto',fontSize:10,color:'var(--green)',background:'var(--gbg)',padding:'2px 8px',borderRadius:20}}>接続済み</span></div>
                  <div style={{padding:'16px'}}>
                    <div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:500,color:'var(--ink2)',marginBottom:5}}>問い合わせ通知チャンネル</div><input type="text" placeholder="#samurai-inquiry" defaultValue="#samurai-inquiry" style={{width:'100%',border:'0.5px solid #86efac',borderRadius:'var(--r)',padding:'8px 10px',fontSize:12,fontFamily:'inherit',background:'var(--gbg)',outline:'none',color:'var(--green)'}}/></div>
                    <div><div style={{fontSize:11,fontWeight:500,color:'var(--ink2)',marginBottom:5}}>識別キーワード（任意）</div><input type="text" placeholder="例：新規問い合わせ、お問い合わせ" style={{width:'100%',border:'0.5px solid var(--b1)',borderRadius:'var(--r)',padding:'8px 10px',fontSize:12,fontFamily:'inherit',background:'var(--bg)',outline:'none'}}/></div>
                  </div>
                </div>
                <div className="cw">
                  <div className="ih">手動入力 — note・リファラル</div>
                  <div style={{padding:'16px',fontSize:12,color:'var(--muted)',lineHeight:1.7}}>
                    <strong style={{color:'var(--ink2)'}}>note 閲覧数</strong>：公式APIが非公開のため自動取得不可。KPIページから週次で手動入力する。<br/>
                    <strong style={{color:'var(--ink2)'}}>VISIOALリファラル</strong>：声がけ数・紹介経由の問い合わせ数はSAMURAIが週次でKPIページから入力する。
                  </div>
                </div>
              </div>
            )}
            {view === 'questions' && <QuestionsView members={members} />}
            {view === 'slack' && (
              <div>
                <div className="pg-title">コミュニケーションログ</div>
                <div className="pg-sub">Slackチャンネルのメッセージ履歴</div>
                <SlackLogView members={members} />
              </div>
            )}
            {view === 'mtg-import' && <MtgImport />}
            {view === 'content-gen' && <ContentGen />}
            {view === 'knowledge' && <Knowledge />}
            {view === 'competitors' && <Competitors />}
            {view === 'members' && (
              <div>
                <div className="pg-title">メンバー管理</div>
                <div className="pg-sub">SAMURAI・THE MOLTSの担当者を管理する</div>
                {(['samurai', 'molts'] as const).map(team => (
                  <div key={team} className="cw" style={{marginBottom:12}}>
                    <div className="ih">{team === 'samurai' ? 'SAMURAI' : 'THE MOLTS'}</div>
                    <div style={{padding:16}}>
                      {members[team].map((name, i) => (
                        <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                          <span style={{flex:1,fontSize:12,color:'var(--ink)'}}>{name}</span>
                          <button onClick={() => {
                            const updated = {...members, [team]: members[team].filter((_,j) => j !== i)}
                            setMembers(updated)
                            fetch('/api/members', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(updated)})
                          }} style={{fontSize:11,color:'var(--muted)',background:'none',border:'0.5px solid var(--b1)',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontFamily:'inherit'}}>削除</button>
                        </div>
                      ))}
                      <button onClick={() => {
                        const val = window.prompt('担当者名を入力')
                        if (val && val.trim()) {
                          const updated = {...members, [team]: [...members[team], val.trim()]}
                          setMembers(updated)
                          fetch('/api/members', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(updated)})
                        }
                      }} style={{fontSize:11,background:'none',border:'0.5px solid var(--b1)',borderRadius:'var(--r)',padding:'4px 12px',cursor:'pointer',fontFamily:'inherit'}}>+ 追加</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {view === 'schedule' && <div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}><div className="pg-title">スケジュール</div><button onClick={()=>setModalTask(null)} style={{padding:"5px 14px",background:"var(--ink)",color:"#fff",border:"none",borderRadius:"var(--r)",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>+ タスク追加</button></div><GanttView tasks={tasks} members={members} onTasksChange={async (updated) => { setTasks(updated); await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }) }} onEditTask={(task) => setModalTask(task)} /></div>}

          </div>
        </main>
      </div>
    <>
      {modalTask !== undefined && (
        <TaskModal
          task={modalTask} members={members}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={() => setModalTask(undefined)}
        />
      )}
    </>
    </>
  )
}
