'use client'
import { useState, useEffect } from 'react'

interface Question {
  id: string
  taskName: string
  content: string
  assignee: string
  deadline: string
  priority: 'urgent' | 'normal'
  status: 'open' | 'answered'
  answer: string
  createdAt: string
}

interface Members { samurai: string[]; molts: string[] }
interface Props { members: Members }

export default function QuestionsView({ members }: Props) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editQ, setEditQ] = useState<Question | null>(null)
  const [form, setForm] = useState<Omit<Question, 'id' | 'createdAt'>>({
    taskName: '', content: '', assignee: '', deadline: '',
    priority: 'normal', status: 'open', answer: ''
  })

  useEffect(() => {
    fetch('/api/questions').then(r => r.json()).then(rawData => { const data = rawData.map((q: any) => ({ ...q, status: q.status === 'unanswered' ? 'open' : q.status === 'answered' ? 'answered' : q.status, priority: q.priority === 'high' ? 'urgent' : q.priority, content: q.content || q.text || '', taskName: q.taskName || q.linkedTask || '' }));
      if (Array.isArray(data)) setQuestions(data)
    }).catch(() => {})
  }, [])

  const save = (updated: Question[]) => {
    setQuestions(updated)
    fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
  }

  const openNew = () => {
    setEditQ(null)
    setForm({ taskName: '', content: '', assignee: '', deadline: '', priority: 'normal', status: 'open', answer: '' })
    setShowForm(true)
  }

  const openEdit = (q: Question) => {
    setEditQ(q)
    setForm({ taskName: q.taskName, content: q.content, assignee: q.assignee, deadline: q.deadline, priority: q.priority, status: q.status, answer: q.answer })
    setShowForm(true)
  }

  const submit = () => {
    if (!form.content.trim()) return
    if (editQ) {
      save(questions.map(q => q.id === editQ.id ? { ...editQ, ...form } : q))
    } else {
      save([...questions, { ...form, id: Date.now().toString(), createdAt: new Date().toISOString().slice(0, 10) }])
    }
    setShowForm(false)
  }

  const remove = (id: string) => save(questions.filter(q => q.id !== id))

  const allMembers = [...members.samurai, ...members.molts]

  const filtered = questions
    .filter(q => filterStatus === 'all' || q.status === filterStatus)
    .filter(q => filterAssignee === 'all' || q.assignee === filterAssignee)

  const byAssignee: Record<string, Question[]> = {}
  filtered.forEach(q => {
    if (!byAssignee[q.assignee]) byAssignee[q.assignee] = []
    byAssignee[q.assignee].push(q)
  })

  const open = questions.filter(q => q.status === 'open').length
  const answered = questions.filter(q => q.status === 'answered').length
  const pct = questions.length > 0 ? Math.round(answered / questions.length * 100) : 0

  const fbtn = (active: boolean) => ({
    padding: '3px 10px',
    border: '0.5px solid ' + (active ? 'var(--ink)' : 'var(--b1)'),
    borderRadius: 20, fontSize: 11, cursor: 'pointer' as const,
    fontFamily: 'inherit', background: active ? 'var(--ink)' : 'none',
    color: active ? '#fff' : 'var(--ink2)',
  })

  const inp: React.CSSProperties = { border: '0.5px solid var(--b1)', borderRadius: 4, padding: '7px 9px', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', width: '100%' }
  const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted)', fontFamily: 'inherit' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="pg-title">質問シート</div>
        <button onClick={openNew} style={{ padding: '5px 14px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>+ 質問追加</button>
      </div>
      <div className="pg-sub">タスク遂行に必要な回答・承認を管理する</div>

      {/* 進捗サマリー */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
        <div className="sc"><div className="sc-ey">質問合計</div><div className="sc-v">{questions.length}</div></div>
        <div className="sc"><div className="sc-ey">未回答</div><div className="sc-v" style={{ color: 'var(--red)' }}>{open}</div></div>
        <div className="sc"><div className="sc-ey">回答済み</div><div className="sc-v" style={{ color: 'var(--green)' }}>{answered}</div></div>
      </div>

      {/* 回答進捗バー */}
      {questions.length > 0 && (
        <div className="cw" style={{ marginBottom: 14 }}>
          <div style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
              <span>回答進捗</span><span>{pct}%（{answered}/{questions.length}）</span>
            </div>
            <div style={{ background: 'var(--b1)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
              <div style={{ width: pct + '%', height: '100%', background: 'var(--green)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      )}

      {/* フィルター */}
      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>ステータス</span>
          {[['all', 'すべて'], ['open', '未回答'], ['answered', '回答済み']].map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)} style={fbtn(filterStatus === val)}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 56 }}>回答者</span>
          {['all', ...allMembers].map(m => (
            <button key={m} onClick={() => setFilterAssignee(m)} style={fbtn(filterAssignee === m)}>{m === 'all' ? '全員' : m}</button>
          ))}
        </div>
      </div>

      {/* 質問リスト（回答者別） */}
      {filtered.length === 0 && <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>質問がありません</div>}
      {Object.entries(byAssignee).map(([assignee, qs]) => (
        <div key={assignee} className="cw" style={{ marginBottom: 10 }}>
          <div className="ih">
            {assignee || '担当者未設定'}
            <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--rbg)', color: 'var(--red)', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              {qs.filter(q => q.status === 'open').length}件未回答
            </span>
          </div>
          {qs.map(q => (
            <div key={q.id} className="ir" style={{ opacity: q.status === 'answered' ? 0.5 : 1 }}>
              <div className="ib">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {q.priority === 'urgent' && <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--rbg)', color: 'var(--red)', padding: '1px 6px', borderRadius: 3 }}>最優先</span>}
                  <span style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }} onClick={() => openEdit(q)}>{q.content}</span>
                </div>
                <div className="im">
                  {q.taskName && <span className="stag">{q.taskName}</span>}
                  {q.deadline && <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted)' }}>期日: {q.deadline}</span>}
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600, background: q.status === 'answered' ? 'var(--gbg)' : 'var(--rbg)', color: q.status === 'answered' ? 'var(--green)' : 'var(--red)' }}>
                    {q.status === 'answered' ? '回答済み' : '未回答'}
                  </span>
                </div>
                {q.answer && <div className="id" style={{ marginTop: 4 }}>回答: {q.answer}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => {
                  const updated = questions.map(x => x.id === q.id ? { ...x, status: x.status === 'open' ? 'answered' : 'open' } as Question : x)
                  save(updated)
                }} style={{ fontSize: 11, background: 'none', border: '0.5px solid var(--b1)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink2)' }}>
                  {q.status === 'open' ? '回答済みにする' : '未回答に戻す'}
                </button>
                <button onClick={() => remove(q.id)} style={{ fontSize: 11, background: 'none', border: '0.5px solid var(--b1)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)' }}>削除</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* 追加/編集フォーム */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 24, width: 440, fontFamily: 'inherit', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{editQ ? '質問を編集' : '質問を追加'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={lbl}>質問内容<textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} style={{ ...inp, resize: 'vertical', minHeight: 72 }} placeholder="例：ドメイン構成はどれにするか？" /></label>
              <label style={lbl}>関連タスク<input value={form.taskName} onChange={e => setForm(f => ({ ...f, taskName: e.target.value }))} style={inp} placeholder="例：VISIOAL LP デザイン・実装・公開" /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={lbl}>
                  回答者
                  <select value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} style={inp}>
                    <option value="">指定なし</option>
                    {allMembers.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label style={lbl}>期日<input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={inp} /></label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={lbl}>
                  優先度
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Question['priority'] }))} style={inp}>
                    <option value="normal">通常</option>
                    <option value="urgent">最優先</option>
                  </select>
                </label>
                <label style={lbl}>
                  ステータス
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Question['status'] }))} style={inp}>
                    <option value="open">未回答</option>
                    <option value="answered">回答済み</option>
                  </select>
                </label>
              </div>
              <label style={lbl}>回答内容（任意）<input value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} style={inp} placeholder="回答後に記録" /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '6px 14px', background: 'none', border: '0.5px solid var(--b1)', color: 'var(--muted)', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>キャンセル</button>
              <button onClick={submit} style={{ padding: '6px 16px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
