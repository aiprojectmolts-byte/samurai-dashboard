'use client'
import { useState, useRef } from 'react'

interface Theme {
  title: string
  summary: string
  xPosts: string[]
  noteTitle: string
  noteOutline: string
  noteBody: string
  okExpressions: string[]
  ngExpressions: string[]
}

interface Result {
  themes: Theme[]
}

export default function ContentGen() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [selectedTheme, setSelectedTheme] = useState<number>(0)
  const [status, setStatus] = useState<'idle'|'analyzing'|'done'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)

  const inp = {
    width: '100%', padding: '8px 10px', border: '0.5px solid var(--b1)',
    borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit',
    background: 'var(--paper)', color: 'var(--ink)', outline: 'none'
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => setText(ev.target?.result as string)
    reader.readAsText(f)
  }

  const analyze = async () => {
    if (!text.trim()) { setError('MTGデータを入力してください'); return }
    setError('')
    setLoading(true)
    setStatus('analyzing')
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: `あなたはSAMURAI ARCHITECTSのマーケティング担当です。建築業界向けAIプロダクトを持つ会社のMTG議事録から発信コンテンツを生成します。
ルール：業界を否定する表現は避ける。変革・進化・可能性を前向きに表現する。加藤CEO個人の発信として自然な口調にする。
必ずJSON形式のみで返してください。前置きや説明文は不要です。
{"themes":[{"title":"テーマタイトル","summary":"概要1〜2文","xPosts":["X投稿1(140文字以内)","X投稿2(140文字以内)","X投稿3(140文字以内)"],"noteTitle":"note記事タイトル","noteOutline":"記事構成（箇条書き）","noteBody":"記事本文800〜1200文字","okExpressions":["OK表現1","OK表現2","OK表現3"],"ngExpressions":["NG表現1","NG表現2","NG表現3"]}]}`,
          messages: [{ role: 'user', content: `以下のMTG議事録から発信テーマを3つ抽出し、各テーマのX投稿文・note記事・OK/NG表現リストを生成してください。\n\n${text.slice(0, 6000)}` }]
        })
      })
      const data = await response.json()
      const raw = data.content?.find((c: any) => c.type === 'text')?.text || ''
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setResult(parsed)
      setStatus('done')
      setSelectedTheme(0)
    } catch (e) {
      setError('解析に失敗しました。もう一度お試しください。')
      setStatus('idle')
    } finally {
      setLoading(false)
    }
  }

  const theme = result?.themes[selectedTheme]

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="pg-title">発信コンテンツ生成</div>
      <div className="pg-sub">MTGデータからX投稿・note記事・OK/NG表現リストを自動生成します</div>

      {status !== 'done' && (
        <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <div onClick={() => fileRef.current?.click()} style={{ border: '1px dashed var(--b1)', borderRadius: 'var(--r)', padding: '20px', textAlign: 'center' as const, cursor: 'pointer', marginBottom: 10 }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>📄</div>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>ファイルをドロップ または クリックして選択</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>.md / .txt 対応</div>
              <input ref={fileRef} type="file" accept=".md,.txt" style={{ display: 'none' }} onChange={handleFile} />
            </div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>またはテキストを直接貼り付け</label>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="MTG議事録・テキストを貼り付けてください..." style={{ ...inp, minHeight: 140, resize: 'vertical' as const }} />
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button onClick={analyze} disabled={loading} style={{ width: '100%', padding: '10px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
            {loading ? '🤖 生成中...' : '🤖 コンテンツを生成する'}
          </button>
        </div>
      )}

      {status === 'done' && result && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{result.themes.length}件のテーマが生成されました</div>
            <button onClick={() => { setStatus('idle'); setResult(null); setText('') }} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>やり直す</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
            {result.themes.map((t, i) => (
              <button key={i} onClick={() => setSelectedTheme(i)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: selectedTheme === i ? 'var(--ink)' : 'var(--paper)', color: selectedTheme === i ? '#fff' : 'var(--ink2)', border: `0.5px solid ${selectedTheme === i ? 'var(--ink)' : 'var(--b1)'}` }}>テーマ{i + 1}: {t.title}</button>
            ))}
          </div>
          {theme && (
            <div>
              <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>テーマ概要</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{theme.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>{theme.summary}</div>
              </div>
              <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>𝕏 投稿文（3パターン）</div>
                {theme.xPosts.map((post, i) => (
                  <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: 12, marginBottom: 8, position: 'relative' as const }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>パターン{i + 1} — {post.length}文字</div>
                    <div style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>{post}</div>
                    <button onClick={() => navigator.clipboard.writeText(post)} style={{ position: 'absolute' as const, top: 10, right: 10, fontSize: 10, padding: '2px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'var(--paper)', cursor: 'pointer', fontFamily: 'inherit' }}>コピー</button>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>note 記事</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{theme.noteTitle}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>構成</div>
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: 10, marginBottom: 12, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>{theme.noteOutline}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>本文</div>
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: 12, fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap' as const, position: 'relative' as const }}>
                  {theme.noteBody}
                  <button onClick={() => navigator.clipboard.writeText(theme.noteBody)} style={{ position: 'absolute' as const, top: 10, right: 10, fontSize: 10, padding: '2px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'var(--paper)', cursor: 'pointer', fontFamily: 'inherit' }}>コピー</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>✓ OK表現</div>
                  {theme.okExpressions.map((ex, i) => (
                    <div key={i} style={{ background: 'var(--gbg)', borderRadius: 4, padding: '6px 10px', marginBottom: 6, fontSize: 12, color: 'var(--ink2)' }}>{ex}</div>
                  ))}
                </div>
                <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>✗ NG表現</div>
                  {theme.ngExpressions.map((ex, i) => (
                    <div key={i} style={{ background: 'var(--rbg)', borderRadius: 4, padding: '6px 10px', marginBottom: 6, fontSize: 12, color: 'var(--ink2)' }}>{ex}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
