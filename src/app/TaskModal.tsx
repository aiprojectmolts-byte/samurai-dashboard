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

interface Props {
  task?: Task | null
  onSave: (task: Task, isNew: boolean) => void
  onDelete?: (task: Task) => void
  onClose: () => void
}

const statusLabel: Record<TaskStatus, string> = {
  todo: '未着手', doing: '進行中', done: '完了', waiting: '対応待ち', delayed: '遅れあり'
}

const 施策Options = ['施策1', '施策2', '施策3', '施策4', '施策5', '施策6', '施策7']

export default function TaskModal({ task, onSave, onDelete, onClose }: Props) {
  const isNew = !task
  const [form, setForm] = useState<Task>(task || {
    施策: '施策1',
    name: '',
    s: new Date().toISOString().split('T')[0],
    e: new Date().toISOString().split('T')[0],
    own: 'molts',
    st: 'todo',
    chg: false,
  })

  useEffect(() => {
    if (task) setForm(task)
  }, [task])

  const handleSubmit = () => {
    if (!form.name.trim()) return
    onSave(form, isNew)
    onClose()
  }

  const handleDelete = () => {
    if (!task) return
    if (confirm(`「${task.name}」を削除しますか？`)) {
      onDelete?.(task)
      onClose()
    }
  }

  return (
    <>
      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; backdrop-filter: blur(2px);
        }
        .modal {
          background: var(--paper); border: 0.5px solid var(--b1);
          border-radius: 10px; width: 440px; max-width: 90vw;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          overflow: hidden;
        }
        .modal-head {
          padding: 14px 18px; border-bottom: 0.5px solid var(--b1);
          display: flex; align-items: center; justify-content: space-between;
        }
        .modal-title { font-size: 14px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em; }
        .modal-close {
          width: 24px; height: 24px; border: none; background: #f0f0ef;
          border-radius: 4px; cursor: pointer; font-size: 14px;
          display: flex; align-items: center; justify-content: center;
          color: var(--muted); transition: background 0.1s;
        }
        .modal-close:hover { background: var(--border); color: var(--ink); }
        .modal-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field-label { font-size: 11px; font-weight: 500; color: var(--ink2); }
        .field input, .field select {
          border: 0.5px solid var(--b1); border-radius: var(--r);
          padding: 8px 10px; font-size: 12px;
          font-family: 'Inter','Noto Sans JP',sans-serif;
          color: var(--ink); background: var(--bg);
          transition: all 0.1s; outline: none; width: 100%;
        }
        .field input:focus, .field select:focus {
          border-color: var(--ink); background: var(--paper);
        }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .modal-foot {
          padding: 12px 18px; border-top: 0.5px solid var(--b1);
          display: flex; align-items: center; justify-content: space-between;
          background: #fafaf9;
        }
        .btn-save {
          padding: 7px 18px; background: var(--ink); color: #fff;
          border: none; border-radius: var(--r); font-size: 12px;
          font-weight: 500; cursor: pointer; font-family: inherit;
          transition: opacity 0.1s;
        }
        .btn-save:hover { opacity: 0.8; }
        .btn-cancel {
          padding: 7px 14px; background: var(--paper);
          border: 0.5px solid var(--b1); border-radius: var(--r);
          font-size: 12px; cursor: pointer; font-family: inherit;
          color: var(--ink2); transition: background 0.1s;
        }
        .btn-cancel:hover { background: var(--bg); }
        .btn-delete {
          padding: 7px 14px; background: var(--rbg);
          border: 0.5px solid #fca5a5; border-radius: var(--r);
          font-size: 12px; cursor: pointer; font-family: inherit;
          color: var(--red); transition: background 0.1s;
        }
        .btn-delete:hover { background: #fee2e2; }
      `}</style>

      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal">
          <div className="modal-head">
            <span className="modal-title">{isNew ? 'タスクを追加' : 'タスクを編集'}</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div className="field">
              <label className="field-label">タスク名</label>
              <input
                type="text"
                placeholder="例：VISIOAL LP コピーライティング"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">施策</label>
                <select value={form.施策} onChange={e => setForm({ ...form, 施策: e.target.value })}>
                  {施策Options.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">担当</label>
                <select value={form.own} onChange={e => setForm({ ...form, own: e.target.value as Task['own'] })}>
                  <option value="molts">THE MOLTS</option>
                  <option value="samurai">SAMURAI</option>
                  <option value="both">共同</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">開始日</label>
                <input
                  type="date"
                  value={form.s}
                  onChange={e => setForm({ ...form, s: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field-label">終了日</label>
                <input
                  type="date"
                  value={form.e}
                  onChange={e => setForm({ ...form, e: e.target.value, chg: !isNew })}
                />
              </div>
            </div>
            <div className="field">
              <label className="field-label">ステータス</label>
              <select value={form.st} onChange={e => setForm({ ...form, st: e.target.value as TaskStatus })}>
                {Object.entries(statusLabel).map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-foot">
            <div>
              {!isNew && (
                <button className="btn-delete" onClick={handleDelete}>削除</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-cancel" onClick={onClose}>キャンセル</button>
              <button className="btn-save" onClick={handleSubmit}>
                {isNew ? '追加する' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
