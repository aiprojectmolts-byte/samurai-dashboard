'use client'
import { useState, useRef, useEffect } from 'react'

const LABELS = ['MTG議事録', '提案書', '参考資料', '会社情報', 'その他']

export default function Knowledge() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchItems() }, [])

  const fetchItems = async () => {
    setLoading(true)
    const res = await fetch('/api/knowledge')
    const data = await res.json()
    setItems(data)
    setLoading(false)
  }

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return
    setUploading(true)
    for (const file of files) {
      try {
        // テキスト抽出
        const fd = new FormData()
        fd.append('file', file)
        const extractRes = await fetch('/api/extract-text', { method: 'POST', body: fd })
        const extractData = await extractRes.json()
        if (!extractRes.ok || !extractData.text) {
          console.error('extract error:', extractData)
          alert(`抽出失敗: ${file.name} - ${JSON.stringify(extractData)}`)
          continue
        }
        const text = extractData.text

        // AIでラベル＆要約
        const aiRes = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: `以下のテキストを分析してください。
ラベルは必ず以下から1つ選んでください：MTG議事録、提案書、参考資料、会社情報、その他
JSONのみ返してください：{"label":"ラベル","summary":"2〜3文の要約","date":"日付があれば抽出（YYYY-MM-DD形式、なければ空文字）"}

テキスト：
${text.slice(0, 3000)}`
            }]
          })
        })
        const aiData = await aiRes.json()
        const aiText = aiData.content?.[0]?.text || '{}'
        let meta = { label: 'その他', summary: '', date: '' }
        try {
          meta = JSON.parse(aiText.replace(/```json|```/g, '').trim())
        } catch {}

        // 保存
        await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `kb_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            filename: file.name,
            label: meta.label || 'その他',
            summary: meta.summary || '',
            date: meta.date || '',
            text: text.slice(0, 10000),
            createdAt: new Date().toISOString()
          })
        })
      } catch (e) {
        console.error(e)
      }
    }
    await fetchItems()
    setUploading(false)
  }

  const deleteItem = async (id: string) => {
    if (!confirm('削除しますか？')) return
    await fetch('/api/knowledge', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const filtered = items.filter(i => {
    const matchLabel = !filterLabel || i.label === filterLabel
    const matchSearch = !search || i.filename.includes(search) || i.summary.includes(search) || i.label.includes(search)
    return matchLabel && matchSearch
  })

  const labelColor: Record<string, string> = {
    'MTG議事録': 'var(--blue)', '提案書': 'var(--green)', '参考資料': 'var(--ink2)',
    '会社情報': '#8b5cf6', 'その他': 'var(--muted)'
  }
  const labelBg: Record<string, string> = {
    'MTG議事録': 'var(--bbg)', '提案書': 'var(--gbg)', '参考資料': 'var(--bg)',
    '会社情報': '#f3e8ff', 'その他': 'var(--bg)'
  }

  return (
    <div className="pg">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="pg-title">ナレッジベース</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{items.length}件</div>
      </div>
      <div className="pg-sub">読み込んだ資料を蓄積・管理します。発信コンテンツ生成時に参照されます。</div>

      {/* アップロードゾーン */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); uploadFiles(Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.md') || f.name.endsWith('.txt') || f.name.endsWith('.pdf'))) }}
        style={{ border: `1px dashed ${dragging ? 'var(--ink)' : 'var(--b1)'}`, borderRadius: 'var(--r)', padding: 20, textAlign: 'center' as const, cursor: 'pointer', marginBottom: 16, background: dragging ? 'var(--bg)' : 'transparent', transition: 'all 0.15s' }}
      >
        <input ref={fileRef} type="file" accept=".md,.txt,.pdf" multiple style={{ display: 'none' }} onChange={e => uploadFiles(Array.from(e.target.files || []))} />
        {uploading ? (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>⏳ アップロード中...</div>
        ) : (
          <>
            <div style={{ fontSize: 13, marginBottom: 4 }}>📂 ファイルをドロップ or クリック</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>.md / .txt / .pdf — AIが自動でラベル付けします</div>
          </>
        )}
      </div>

      {/* 検索＆フィルター */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ファイル名・要約で検索..."
          style={{ flex: 1, padding: '6px 10px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit', background: 'var(--paper)' }}
        />
        <select
          value={filterLabel}
          onChange={e => setFilterLabel(e.target.value)}
          style={{ padding: '6px 10px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit', background: 'var(--paper)' }}
        >
          <option value="">すべて</option>
          {LABELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* 一覧 */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: 20, textAlign: 'center' as const }}>
          {items.length === 0 ? 'まだデータがありません' : '該当なし'}
        </div>
      ) : (
        filtered.map(item => (
          <div key={item.id} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 14, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: labelBg[item.label] || 'var(--bg)', color: labelColor[item.label] || 'var(--muted)' }}>{item.label}</span>
                  {item.date && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{item.date}</span>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{item.filename}</div>
                {item.summary && <div style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.6 }}>{item.summary}</div>}
              </div>
              <button
                onClick={() => deleteItem(item.id)}
                style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}
              >✕</button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
