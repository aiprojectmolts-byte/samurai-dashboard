'use client'
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'

interface Category { id: string; name: string }

export default function CategorySettings() {
  const [categories, setCategories] = useState<Category[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [newName, setNewName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      if (Array.isArray(data)) setCategories(data)
    } catch { setError('カテゴリの取得に失敗しました') }
  }

  useEffect(() => { load() }, [])

  const startEdit = (c: Category) => { setEditingId(c.id); setEditValue(c.name); setError('') }
  const cancelEdit = () => { setEditingId(null); setEditValue('') }

  const saveEdit = async (id: string) => {
    const name = editValue.trim()
    if (!name) { cancelEdit(); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) })
      if (!res.ok) throw new Error()
      cancelEdit()
      await load()
    } catch { setError('カテゴリ名の変更に失敗しました') }
    setBusy(false)
  }

  const addCategory = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      if (!res.ok) throw new Error()
      setNewName('')
      await load()
    } catch { setError('カテゴリの追加に失敗しました') }
    setBusy(false)
  }

  const deleteCategory = async (id: string) => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!res.ok) throw new Error()
      setConfirmDeleteId(null)
      await load()
    } catch { setError('カテゴリの削除に失敗しました') }
    setBusy(false)
  }

  return (
    <div>
      <div className="pg-title">カテゴリ管理</div>
      <div className="pg-sub">タスクの施策カテゴリを追加・編集・削除する</div>

      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

      <div className="cw" style={{ marginBottom: 12 }}>
        <div className="ih">カテゴリ一覧</div>
        <div style={{ padding: 16 }}>
          {categories.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>カテゴリがありません</div>}
          {categories.map(c => (
            <div key={c.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingId === c.id ? (
                  <>
                    <input value={editValue} autoFocus onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') cancelEdit() }}
                      style={{ ...inp, flex: 1 }} />
                    <button onClick={() => saveEdit(c.id)} disabled={busy} style={primaryBtn}>保存</button>
                    <button onClick={cancelEdit} style={ghostBtn}>キャンセル</button>
                  </>
                ) : (
                  <>
                    <span onClick={() => startEdit(c)} style={{ flex: 1, fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}>{c.name}</span>
                    <button onClick={() => startEdit(c)} style={ghostBtn}>編集</button>
                    <button onClick={() => { setConfirmDeleteId(c.id); setError('') }} style={ghostBtn}>削除</button>
                  </>
                )}
              </div>
              {confirmDeleteId === c.id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, padding: '8px 10px', background: 'var(--rbg)', border: '0.5px solid var(--red)', borderRadius: 6 }}>
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--red)' }}>このカテゴリに紐づくタスクは&quot;未分類&quot;になります</span>
                  <button onClick={() => deleteCategory(c.id)} disabled={busy} style={dangerBtn}>削除する</button>
                  <button onClick={() => setConfirmDeleteId(null)} style={ghostBtn}>キャンセル</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="cw">
        <div className="ih">新しいカテゴリを追加</div>
        <div style={{ padding: 16, display: 'flex', gap: 8 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCategory() }}
            placeholder="例：施策8 / 採用広報" style={{ ...inp, flex: 1 }} />
          <button onClick={addCategory} disabled={busy || !newName.trim()} style={{ ...primaryBtn, opacity: (busy || !newName.trim()) ? 0.4 : 1 }}>+ 追加</button>
        </div>
      </div>
    </div>
  )
}

const inp: CSSProperties = { border: '0.5px solid var(--b1)', borderRadius: 4, padding: '7px 9px', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--ink)', outline: 'none' }
const primaryBtn: CSSProperties = { padding: '6px 14px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
const ghostBtn: CSSProperties = { padding: '4px 10px', background: 'none', border: '0.5px solid var(--b1)', borderRadius: 4, fontSize: 11, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
const dangerBtn: CSSProperties = { padding: '4px 10px', background: 'var(--red)', border: '0.5px solid var(--red)', borderRadius: 4, fontSize: 11, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
