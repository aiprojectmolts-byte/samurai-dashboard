'use client'
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'

type TaskStatus = 'todo' | 'doing' | 'thread-review' | 'review' | 'done' | 'waiting' | 'delayed'

interface Task {
  id?: string
  施策: string; name: string; s: string; e: string
  own: 'molts' | 'samurai' | 'both'; st: TaskStatus; chg: boolean
  assignee?: string; blocker?: boolean; impact?: string; src?: string; 備考?: string; 背景?: string; 背景ソース?: string; phase?: string; threadUrl?: string; linkedQuestionId?: string; label?: string
}

interface Members { samurai: string[]; molts: string[] }

interface QuestionInput { content: string; assignee: string; deadline: string; priority: 'urgent' | 'normal' }

interface Props {
  task: Task | null
  members: Members
  onSave: (task: Task, isNew: boolean, question?: QuestionInput) => void
  onDelete: (task: Task) => void
  onClose: () => void
}

export default function TaskModal({ task, members, onSave, onDelete, onClose }: Props) {
  const isNew = task === null
  const [form, setForm] = useState<Task>(task ?? {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    施策: '施策1', name: '', s: new Date().toISOString().slice(0, 10),
    e: new Date().toISOString().slice(0, 10), own: 'molts', st: 'todo', chg: false,
    assignee: '', blocker: false, impact: '', src: 'manual',
  })

  const set = <K extends keyof Task>(k: K, v: Task[K]) => setForm(f => ({ ...f, [k]: v }))

  const [categories, setCategories] = useState<string[]>([])
  const [phases, setPhases] = useState<{ id: string; name: string; order: number }[]>([])

  // 質問シート登録セクション
  const [toQuestion, setToQuestion] = useState(false)
  const [qForm, setQForm] = useState<QuestionInput>({
    content: task?.impact?.trim() || task?.name || '',
    assignee: '',
    deadline: task?.e || '',
    priority: task?.blocker ? 'urgent' : 'normal',
  })
  const setQ = <K extends keyof QuestionInput>(k: K, v: QuestionInput[K]) => setQForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then((data: { id: string; name: string }[]) => { if (Array.isArray(data)) setCategories(data.map(c => c.name)) })
      .catch(() => {})
    fetch('/api/phases')
      .then(r => r.json())
      .then((data: { id: string; name: string; order: number }[]) => { if (Array.isArray(data)) setPhases([...data].sort((a, b) => (a.order || 0) - (b.order || 0))) })
      .catch(() => {})
    // 既に質問シートへ登録済みなら、その質問の現在値をプリフィルして編集できるようにする
    if (task?.linkedQuestionId) {
      fetch('/api/questions')
        .then(r => r.json())
        .then((data: any[]) => {
          const q = Array.isArray(data) ? data.find(x => x?.id === task.linkedQuestionId) : null
          if (q) {
            setToQuestion(true)
            setQForm({
              content: q.content || q.text || '',
              assignee: q.assignee || '',
              deadline: q.deadline || '',
              priority: q.priority === 'high' || q.priority === 'urgent' ? 'urgent' : 'normal',
            })
          }
        })
        .catch(() => {})
    }
  }, [task])

  // 「未分類」を先頭に。既存タスクの施策値が一覧に無い場合も選択肢に含めて後方互換を保つ
  const categoryOptions = Array.from(new Set(['未分類', ...categories, form.施策].filter(Boolean)))

  const assigneeList = form.own === 'molts' ? members.molts
    : form.own === 'samurai' ? members.samurai
    : [...members.molts, ...members.samurai]
  const allMembers = [...members.samurai, ...members.molts]

  const handleSave = () => {
    if (!form.name.trim()) return
    const question = toQuestion && qForm.content.trim() ? qForm : undefined
    onSave(form, isNew, question)
    onClose()
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{isNew ? 'タスク追加' : 'タスク編集'}</div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={lbl}>
            タスク名
            <input value={form.name} onChange={e => set('name', e.target.value)} style={inp} placeholder="例：事例1本目：取材・執筆・公開" autoFocus />
          </label>

          <label style={lbl}>
            フェーズ
            <select value={form.phase ?? ''} onChange={e => set('phase', e.target.value)} style={inp}>
              <option value="">未設定</option>
              {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <label style={lbl}>
            施策
            <select value={form.施策} onChange={e => set('施策', e.target.value)} style={inp}>
              {categoryOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label style={lbl}>
            ラベル（任意）
            <input value={form.label ?? ''} onChange={e => set('label', e.target.value)} style={inp} placeholder="例：6/10定例・6/17定例" />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={lbl}>開始日<input type="date" value={form.s} onChange={e => set('s', e.target.value)} style={inp} /></label>
            <label style={lbl}>終了日<input type="date" value={form.e} onChange={e => set('e', e.target.value)} style={inp} /></label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={lbl}>
              会社
              <select value={form.own} onChange={e => { set('own', e.target.value as Task['own']); set('assignee', '') }} style={inp}>
                <option value="molts">THE MOLTS</option>
                <option value="samurai">SAMURAI</option>
                <option value="both">両方</option>
              </select>
            </label>
            <label style={lbl}>
              担当者
              <select value={form.assignee ?? ''} onChange={e => set('assignee', e.target.value)} style={inp}>
                <option value="">指定なし</option>
                {assigneeList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>

          <label style={lbl}>
            ステータス
            <select value={form.st} onChange={e => set('st', e.target.value as TaskStatus)} style={inp}>
              <option value="todo">予定</option>
              <option value="doing">進行中</option>
              <option value="thread-review">スレッド確認中</option>
              <option value="review">定例確認</option>
              <option value="waiting">着手待ち</option>
              <option value="delayed">遅延</option>
              <option value="done">完了</option>
            </select>
          </label>

          {form.st === 'thread-review' && (
            <label style={lbl}>
              Slackスレッドの URL
              <input value={form.threadUrl ?? ''} onChange={e => set('threadUrl', e.target.value)} style={inp} placeholder="https://〜.slack.com/archives/..." />
            </label>
          )}

          <label style={lbl}>
            ソース
            <select value={form.src ?? 'manual'} onChange={e => set('src', e.target.value)} style={inp}>
              <option value="manual">手動</option>
              <option value="slack">Slack</option>
            </select>
          </label>

          <label style={lbl}>
            影響（ブロックされるタスク・作業）
            <input value={form.impact ?? ''} onChange={e => set('impact', e.target.value)} style={inp} placeholder="例：LP公開が止まる" />
          </label>

          <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.blocker ?? false} onChange={e => set('blocker', e.target.checked)}
              style={{ width: 14, height: 14, accentColor: 'var(--red)' }} />
            <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>ブロッカー（他のタスクが止まる）</span>
          </label>

          <label style={lbl}>
            背景・追加経緯
            <textarea value={form.背景 ?? ''} onChange={e => set('背景', e.target.value)} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="このタスクが生まれた理由・目的（任意）" />
          </label>

          <label style={lbl}>
            ソース
            <input value={form.背景ソース ?? ''} onChange={e => set('背景ソース', e.target.value)} style={inp} placeholder="例：2026-06-03 キックオフMTG（任意）" />
          </label>

          <label style={lbl}>
            備考・FBメモ
            <textarea value={form.備考 ?? ''} onChange={e => set('備考', e.target.value)} style={{ ...inp, minHeight: 72, resize: 'vertical' }} placeholder="定例での確認事項・フィードバックメモなど（任意）" />
          </label>

          {/* 質問シート連携 */}
          <div style={{ border: '0.5px solid var(--b1)', borderRadius: 6, padding: 12, background: toQuestion ? '#fffdf5' : 'transparent' }}>
            <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={toQuestion} onChange={e => setToQuestion(e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--ink)' }} />
              <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>❓ このタスクを質問シートに登録する</span>
            </label>
            {toQuestion && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <label style={lbl}>
                  質問内容
                  <textarea value={qForm.content} onChange={e => setQ('content', e.target.value)} style={{ ...inp, minHeight: 56, resize: 'vertical' }} placeholder="回答・承認してほしい内容（例：ドメイン構成はどれにするか？）" />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={lbl}>
                    回答者
                    <select value={qForm.assignee} onChange={e => setQ('assignee', e.target.value)} style={inp}>
                      <option value="">指定なし</option>
                      {allMembers.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label style={lbl}>回答期日<input type="date" value={qForm.deadline} onChange={e => setQ('deadline', e.target.value)} style={inp} /></label>
                </div>
                <label style={lbl}>
                  優先度
                  <select value={qForm.priority} onChange={e => setQ('priority', e.target.value as QuestionInput['priority'])} style={inp}>
                    <option value="normal">通常</option>
                    <option value="urgent">最優先</option>
                  </select>
                </label>
                <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
                  保存すると質問シートに{form.linkedQuestionId ? '反映' : '追加'}され、このタスクと相互リンクされます。
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          {!isNew && <button onClick={() => { onDelete(form); onClose() }} style={delBtn}>削除</button>}
          <button onClick={onClose} style={cancelBtn}>キャンセル</button>
          <button onClick={handleSave} style={saveBtn}>保存</button>
        </div>
      </div>
    </div>
  )
}

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modal: CSSProperties = { background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 24, width: 440, fontFamily: 'inherit', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: '90vh', overflowY: 'auto' }
const lbl: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted)', fontFamily: 'inherit' }
const inp: CSSProperties = { border: '0.5px solid var(--b1)', borderRadius: 4, padding: '7px 9px', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--ink)', outline: 'none' }
const closeBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: '2px 4px' }
const saveBtn: CSSProperties = { padding: '6px 16px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
const cancelBtn: CSSProperties = { padding: '6px 14px', background: 'none', border: '0.5px solid var(--b1)', color: 'var(--muted)', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
const delBtn: CSSProperties = { padding: '6px 14px', background: 'none', border: '0.5px solid #c0392b', color: '#c0392b', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
