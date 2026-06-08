'use client'
import { useState, useRef } from 'react'

type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'waiting' | 'delayed'
interface Task { 施策: string; name: string; s: string; e: string; own: 'molts'|'samurai'|'both'; st: TaskStatus; chg: boolean; assignee?: string; blocker?: boolean; impact?: string; src?: string; 備考?: string }
interface Question { id: string; text: string; assignee: string; status: 'unanswered'|'answered'; priority: 'high'|'normal'; linkedTask: string; src: string; createdAt?: string }
interface Extracted { tasks: Task[]; questions: Question[] }

export default function MtgImport() {
  const [text, setText] = useState('')
  const [mtgName, setMtgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Extracted | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())
  const [status, setStatus] = useState<'idle'|'analyzing'|'preview'|'done'>('idle')
  const [error, setError] = useState('')
  const [registering, setRegistering] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().slice(0, 10)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => setText(ev.target?.result as string)
    reader.readAsText(f)
    if (!mtgName) setMtgName(f.name.replace(/\.[^.]+$/, ''))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => setText(ev.target?.result as string)
    reader.readAsText(f)
    if (!mtgName) setMtgName(f.name.replace(/\.[^.]+$/, ''))
  }

  const analyze = async () => {
    if (!text.trim()) { setError('テキストを入力またはファイルをアップロードしてください'); return }
    if (!mtgName.trim()) { setError('MTG名を入力してください'); return }
    setError(''); setLoading(true); setStatus('analyzing')
    const src = `${today} ${mtgName}`
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `以下のMTG議事録・資料から、タスクと質問を抽出してください。

必ずJSONのみを返し、前後に説明文・マークダウンコードブロックは不要です。

出力形式:
{
  "tasks": [
    {
      "施策": "施策X",
      "name": "タスク名（具体的なアクション）",
      "s": "${today}",
      "e": "YYYY-MM-DD（期日が明示されていれば、なければ2〜4週間後）",
      "own": "molts か samurai か both",
      "st": "todo",
      "chg": false,
      "assignee": "担当者名（わかれば）",
      "blocker": false,
      "src": "${src}"
    }
  ],
  "questions": [
    {
      "id": "q-${Date.now()}-0",
      "text": "質問内容",
      "assignee": "回答すべき担当者名",
      "status": "unanswered",
      "priority": "high か normal",
      "linkedTask": "関連タスク名（あれば）",
      "src": "${src}",
      "createdAt": "${today}"
    }
  ]
}

施策の分類基準:
- 施策1: 計測・フォーム系
- 施策2: 事例コンテンツ
- 施策3: LP制作
- 施策4: LP改修
- 施策5: CEO発信
- 施策6: リファラル
- 施策7: リファラル制度
- 上記に当てはまらない場合は「施策X」

ownの判断:
- THE MOLTS側のタスク: "molts"
- SAMURAI ARCHITECTS側のタスク: "samurai"
- 両社共同: "both"

---
${text.slice(0, 8000)}`
          }]
        })
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed: Extracted = JSON.parse(clean)
      setResult(parsed)
      setSelectedTasks(new Set(parsed.tasks.map((_, i) => i)))
      setSelectedQuestions(new Set(parsed.questions.map((_, i) => i)))
      setStatus('preview')
    } catch (e) {
      setError('解析に失敗しました。もう一度お試しください。')
      setStatus('idle')
    }
    setLoading(false)
  }

  const register = async () => {
    if (!result) return
    setRegistering(true)
    try {
      const tasksToAdd = result.tasks.filter((_, i) => selectedTasks.has(i))
      const questionsToAdd = result.questions.filter((_, i) => selectedQuestions.has(i))

      if (tasksToAdd.length > 0) {
        const existRes = await fetch('/api/tasks')
        const existing = await existRes.json()
        const newList = Array.isArray(existing) ? [...existing, ...tasksToAdd] : tasksToAdd
        await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newList) })
      }

      if (questionsToAdd.length > 0) {
        const existRes = await fetch('/api/questions')
        const existing = await existRes.json()
        const newList = Array.isArray(existing) ? [...existing, ...questionsToAdd] : questionsToAdd
        await fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newList) })
      }

      // ナレッジにも自動保存
      await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `kb_mtg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          filename: mtgName,
          label: 'MTG議事録',
          summary: `タスク${tasksToAdd.length}件・質問${questionsToAdd.length}件を含むMTG議事録`,
          date: today,
          text: text.slice(0, 10000),
          createdAt: new Date().toISOString()
        })
      })

      // ナレッジにも自動保存
      await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `kb_mtg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          filename: mtgName,
          label: 'MTG議事録',
          summary: `タスク${tasksToAdd.length}件・質問${questionsToAdd.length}件を含むMTG議事録`,
          date: today,
          text: text.slice(0, 10000),
          createdAt: new Date().toISOString()
        })
      })

      setStatus('done')
    } catch (e) {
      setError('登録に失敗しました')
    }
    setRegistering(false)
  }

  const reset = () => { setText(''); setMtgName(''); setResult(null); setStatus('idle'); setError('') }

  const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '0.5px solid var(--b1)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: 'var(--paper)', color: 'var(--ink)', boxSizing: 'border-box' }

  return (
    <div>
      <div className="pg-title">MTGデータ取り込み</div>
      <div className="pg-sub">議事録・資料をアップロードして、タスクと質問を自動抽出します</div>

      {status === 'done' ? (
        <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>登録完了しました</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>タスクトラッカー・質問シートに反映されました</div>
          <button onClick={reset} style={{ padding: '7px 20px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>続けて取り込む</button>
        </div>
      ) : status === 'preview' && result ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>抽出結果プレビュー</div>
            <button onClick={reset} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>← やり直す</button>
          </div>

          {result.tasks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="sh" style={{ marginBottom: 8 }}>タスク ({result.tasks.filter((_, i) => selectedTasks.has(i)).length}/{result.tasks.length}件選択)</div>
              {result.tasks.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: selectedTasks.has(i) ? 'var(--paper)' : 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 6, marginBottom: 4, opacity: selectedTasks.has(i) ? 1 : 0.5 }}>
                  <input type="checkbox" checked={selectedTasks.has(i)} onChange={e => { const s = new Set(selectedTasks); e.target.checked ? s.add(i) : s.delete(i); setSelectedTasks(s) }} style={{ marginTop: 2, cursor: 'pointer' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, background: 'var(--bg)', border: '0.5px solid var(--b1)', padding: '1px 5px', borderRadius: 3, color: 'var(--muted)' }}>{t.施策}</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{t.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.assignee || t.own} · {t.s} 〜 {t.e}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.questions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="sh" style={{ marginBottom: 8 }}>質問 ({result.questions.filter((_, i) => selectedQuestions.has(i)).length}/{result.questions.length}件選択)</div>
              {result.questions.map((q, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: selectedQuestions.has(i) ? 'var(--paper)' : 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 6, marginBottom: 4, opacity: selectedQuestions.has(i) ? 1 : 0.5 }}>
                  <input type="checkbox" checked={selectedQuestions.has(i)} onChange={e => { const s = new Set(selectedQuestions); e.target.checked ? s.add(i) : s.delete(i); setSelectedQuestions(s) }} style={{ marginTop: 2, cursor: 'pointer' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{q.text}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>担当: {q.assignee} · {q.priority === 'high' ? '🔴 高' : '普通'}{q.linkedTask ? ` · 関連: ${q.linkedTask}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.tasks.length === 0 && result.questions.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>抽出できるタスク・質問が見つかりませんでした</div>
          )}

          {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}

          <button
            onClick={register}
            disabled={registering || (selectedTasks.size === 0 && selectedQuestions.size === 0)}
            style={{ width: '100%', padding: '10px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (selectedTasks.size === 0 && selectedQuestions.size === 0) ? 0.4 : 1 }}
          >
            {registering ? '登録中...' : `選択した ${selectedTasks.size + selectedQuestions.size} 件を登録`}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>MTG名 / ソース名</label>
            <input value={mtgName} onChange={e => setMtgName(e.target.value)} placeholder="例: キックオフMTG" style={inp} />
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>登録日 {today} と組み合わせて「{today} {mtgName || 'MTG名'}」としてソース元に設定されます</div>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{ border: '1.5px dashed var(--b1)', borderRadius: 'var(--r)', padding: '24px', textAlign: 'center', cursor: 'pointer', marginBottom: 12, background: 'var(--bg)' }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>📄</div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>ファイルをドロップ または クリックして選択</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>.md / .txt 対応</div>
            <input ref={fileRef} type="file" accept=".md,.txt" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>またはテキストを直接貼り付け</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="議事録・資料のテキストを貼り付けてください..."
              style={{ ...inp, minHeight: 120, resize: 'vertical' }}
            />
          </div>

          {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}

          <button
            onClick={analyze}
            disabled={loading}
            style={{ width: '100%', padding: '10px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '🤖 解析中...' : '🤖 AIで解析する'}
          </button>
        </div>
      )}
    </div>
  )
}
