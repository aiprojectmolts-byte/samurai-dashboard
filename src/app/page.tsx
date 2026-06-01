'use client'
import KpiView from './KpiView'
import GanttView from './GanttView'

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

export default function Dashboard() {
  const [view, setView] = useState('home')
  const [tasks, setTasks] = useState<Task[]>(defaultTasks)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  useEffect(() => {
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

  const waiting = tasks.filter(t => t.st === 'waiting')
  const delayed = tasks.filter(t => t.st === 'delayed')
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
            タスクトラッカー <span className="nb nb-r">{waiting.length}件</span>
          </div>
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
                    <span className="kgi-v">12</span>
                    <span className="chip cg">+3 先月比</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    {[['Rendery','4','+1','cg'],['knock knock AI','5','+2','cg'],['VISIOAL','2','±0','cn'],['カスタム','1','−1','cr']].map(([label, val, diff, cls]) => (
                      <div key={label} style={{ background: 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>{val}</div>
                        <span className={`chip ${cls}`}>{diff}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="stat-grid">
                  <div className="sc"><div className="sc-ey">VISIOAL LP CVR</div><div className="sc-v">3.2<span style={{ fontSize: 13, fontWeight: 400 }}>%</span></div><div className="sc-sub">GA4 <span className="chip cg">+0.8%</span></div></div>
                  <div className="sc"><div className="sc-ey">X インプレッション</div><div className="sc-v" style={{ fontSize: 22 }}>18.4K</div><div className="sc-sub"><span className="chip cg">+2.1K 先週比</span></div></div>
                  <div className="sc"><div className="sc-ey">note 閲覧数</div><div className="sc-v" style={{ fontSize: 22 }}>4,820</div><div className="sc-sub"><span className="chip cr">−180 先週比</span></div></div>
                  <div className="sc"><div className="sc-ey">リファラル声がけ</div><div className="sc-v">3<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>/3</span></div><div className="sc-sub" style={{ color: 'var(--green)' }}>フェーズ1目標達成</div></div>
                  <div className="sc"><div className="sc-ey">対応待ち / 遅れあり</div><div className="sc-v" style={{ color: 'var(--red)' }}>{waiting.length}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}> · </span><span style={{ color: 'var(--orange)' }}>{delayed.length}</span></div><div className="sc-sub" style={{ color: 'var(--red)' }}>要対応</div></div>
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
                        <div className="it">{t.name}</div>
                        <div className="im"><span className="stag">{t.施策}</span><span className={`ob ${ownerClass[t.own]}`}>{ownerLabel[t.own]}</span></div>
                      </div>
                    </div>
                  ))}
                  {delayed.length > 0 && <div className="ih" style={{ color: 'var(--orange)' }}>遅れあり <span className="nb nb-o">{delayed.length}</span></div>}
                  {delayed.map((t, i) => (
                    <div className="ir" key={i}>
                      <span className="il il-d">遅れあり</span>
                      <div className="ib">
                        <div className="it">{t.name}</div>
                        <div className="im"><span className="stag">{t.施策}</span><span className={`ob ${ownerClass[t.own]}`}>{ownerLabel[t.own]}</span>{t.chg && <span className="ctag">期日変更あり</span>}</div>
                      </div>
                    </div>
                  ))}
                </div>

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
                        <div className="tmeta"><span className={`ob ${ownerClass[t.own]}`}>{ownerLabel[t.own]}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* タスクトラッカー */}
            {view === 'tasks' && (
              <div>
                <div className="pg-title">タスクトラッカー</div>
                <div className="pg-sub">対応待ち・遅れあり・進行中タスクを優先度別に管理する</div>
                <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                  <div className="sc"><div className="sc-ey">対応待ち</div><div className="sc-v" style={{ color: 'var(--red)' }}>{waiting.length}</div><div className="sc-sub" style={{ color: 'var(--red)' }}>即対応</div></div>
                  <div className="sc"><div className="sc-ey">遅れあり</div><div className="sc-v" style={{ color: 'var(--orange)' }}>{delayed.length}</div><div className="sc-sub" style={{ color: 'var(--orange)' }}>期日超過</div></div>
                  <div className="sc"><div className="sc-ey">進行中</div><div className="sc-v" style={{ color: 'var(--yellow)' }}>{doing.length}</div><div className="sc-sub">タスク</div></div>
                  <div className="sc"><div className="sc-ey">完了</div><div className="sc-v" style={{ color: 'var(--green)' }}>{done.length}</div><div className="sc-sub">タスク</div></div>
                </div>

                {[
                  { label: '対応待ち', color: 'var(--red)', items: waiting, cls: 'il-w', nbcls: 'nb-r' },
                  { label: '遅れあり', color: 'var(--orange)', items: delayed, cls: 'il-d', nbcls: 'nb-o' },
                  { label: '進行中', color: 'var(--ink)', items: doing, cls: 'il-y', nbcls: 'nb-o' },
                  { label: '完了', color: 'var(--green)', items: done, cls: 'il-g', nbcls: '' },
                ].map(({ label, color, items, cls, nbcls }) => (
                  <div className="cw" key={label} style={{ marginBottom: 8 }}>
                    <div className="ih" style={{ color }}>{label} <span className={`nb ${nbcls}`}>{items.length}</span></div>
                    {items.map((t) => {
                      const idx = tasks.indexOf(t)
                      return (
                        <div className="ir" key={t.name} style={{ opacity: t.st === 'done' ? 0.4 : 1 }}>
                          <span className={`il ${cls}`}>{t.施策}</span>
                          <div className="ib">
                            <div className="it">{t.name}</div>
                            {t.chg && <div className="im"><span className="ctag">期日変更あり</span></div>}
                          </div>
                          <select
                            className="st-sel"
                            value={t.st}
                            onChange={(e) => updateTaskStatus(idx, e.target.value as TaskStatus)}
                          >
                            {Object.entries(statusLabel).map(([val, lbl]) => (
                              <option key={val} value={val}>{lbl}</option>
                            ))}
                          </select>
                          <span className={`ob ${ownerClass[t.own]}`}>{ownerLabel[t.own]}</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* KPI・スケジュールは今後実装 */}
            {view === 'kpi' && <KpiView />}
            {view === 'schedule' && <div><div className="pg-title">スケジュール</div><GanttView tasks={tasks} onTasksChange={setTasks} /></div>}

          </div>
        </main>
      </div>
    </>
  )
}
