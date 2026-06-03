'use client'
import { useState, useRef } from 'react'

interface Plan {
  title: string
  target: string
  angle: string
  point: string
}

interface EditedPlan extends Plan {
  okExpressions: string[]
  ngExpressions: string[]
  direction: string
}

interface Content {
  xPosts: string[]
  noteTitle: string
  noteOutline: string
  noteBody: string
}

interface FinalResult {
  plan: EditedPlan
  content: Content
}

export default function ContentGen() {
  const [text, setText] = useState('')
  const [step, setStep] = useState<'input'|'planning'|'editing'|'writing'|'done'>('input')
  const [plans, setPlans] = useState<Plan[]>([])
  const [editedPlans, setEditedPlans] = useState<EditedPlan[]>([])
  const [results, setResults] = useState<FinalResult[]>([])
  const [selectedResult, setSelectedResult] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // 履歴読み込み
  const fetchHistory = async () => {
    const res = await fetch('/api/content-plans')
    const data = await res.json()
    setHistory(data)
  }

  // 企画を履歴に保存
  const saveToHistory = async (plans: any[], date: string) => {
    await fetch('/api/content-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plans, date, fileNames })
    })
    fetchHistory()
  }
  const [dragging, setDragging] = useState(false)
  const [fileNames, setFileNames] = useState<string[]>([])

  const inp = {
    width: '100%', padding: '8px 10px', border: '0.5px solid var(--b1)',
    borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit',
    background: 'var(--paper)', color: 'var(--ink)', outline: 'none'
  }

  const callClaude = async (system: string, userMsg: string) => {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system,
        messages: [{ role: 'user', content: userMsg }]
      })
    })
    const data = await res.json()
    const raw = data.content?.find((c: any) => c.type === 'text')?.text || ''
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  }

  const readFiles = async (files: File[]) => {
    if (files.length === 0) return
    setFileNames(files.map(f => f.name))
    const texts = await Promise.all(files.map(async f => {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/extract-text', { method: 'POST', body: fd })
      const data = await res.json()
      return data.text || ''
    }))
    setText(texts.join('\n\n---\n\n'))
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    readFiles(Array.from(e.target.files || []))
  }

  // STEP1: 企画エージェント
  const runPlanning = async () => {
    if (!text.trim()) { setError('MTGデータを入力してください'); return }
    setError(''); setLoading(true); setStep('planning')
    try {
      await fetchHistory()
      const pastPlans = history.length > 0
        ? `\n\n【過去の企画履歴（被りを避けてください）】\n${history.flatMap((h: any) => h.plans || []).map((p: any) => `・${p.title}`).join('\n')}`
        : ''
      const result = await callClaude(
        `あなたはSAMURAI ARCHITECTSの企画担当AIです。
MTG議事録から「加藤CEOが外部発信すべきテーマ」を抽出します。
建築×AIの文脈で、業界に価値を届けられる企画を考えてください。
JSONのみ返してください：{"plans":[{"title":"企画タイトル","target":"想定読者","angle":"切り口・視点","point":"伝えたい核心"}]}`,
        `以下のMTG議事録から発信企画を3つ考えてください。${pastPlans}\n\n${text.slice(0, 6000)}`
      )
      setPlans(result.plans)
    } catch (e) {
      setError('企画生成に失敗しました。'); setStep('input')
    } finally {
      setLoading(false)
    }
  }

  // STEP2: 編集エージェント
  const runEditing = async () => {
    setError(''); setLoading(true); setStep('editing')
    try {
      const result = await callClaude(
        `あなたはSAMURAI ARCHITECTSの編集担当AIです。
企画案に対してOK/NG表現と修正方針を出します。
ルール：
- 業界を否定・見下す表現はNG（例：「昭和的」「デジタル音痴」「遅れている」）
- 変革・進化・可能性を前向きに表現する
- 加藤CEO個人の言葉として自然な表現にする
JSONのみ返してください：{"editedPlans":[{"title":"","target":"","angle":"","point":"","okExpressions":["OK表現1","OK表現2","OK表現3"],"ngExpressions":["NG表現1","NG表現2","NG表現3"],"direction":"執筆方針（1〜2文）"}]}`,
        `以下の企画案を編集チェックしてください：\n${JSON.stringify(plans, null, 2)}`
      )
      setEditedPlans(result.editedPlans)
    } catch (e) {
      setError('編集チェックに失敗しました。'); setStep('planning')
    } finally {
      setLoading(false)
    }
  }

  // STEP3: 執筆エージェント
  const runWriting = async () => {
    setError(''); setLoading(true); setStep('writing')
    try {
      const result = await callClaude(
        `あなたはSAMURAI ARCHITECTSの執筆担当AIです。
編集方針に基づいてX投稿文とnote記事を執筆します。
加藤CEOの一人称で、建築×AIの専門家として自然な口調で書いてください。
JSONのみ返してください：{"results":[{"xPosts":["X投稿1(140文字以内)","X投稿2(140文字以内)","X投稿3(140文字以内)"],"noteTitle":"noteタイトル","noteOutline":"記事構成（箇条書き）","noteBody":"記事本文800〜1200文字"}]}`,
        `以下の編集済み企画案をもとにコンテンツを執筆してください：\n${JSON.stringify(editedPlans, null, 2)}`
      )
      const finalResults = editedPlans.map((plan, i) => ({
        plan,
        content: result.results[i] || result.results[0]
      }))
      setResults(finalResults)
      setStep('done')
      setSelectedResult(0)
      await saveToHistory(editedPlans, new Date().toLocaleDateString('ja-JP'))
    } catch (e) {
      setError('執筆に失敗しました。'); setStep('editing')
    } finally {
      setLoading(false)
    }
  }

  const stepLabel: Record<string, string> = {
    input: '① MTGデータ入力',
    planning: '② 企画エージェント',
    editing: '③ 編集エージェント',
    writing: '④ 執筆エージェント',
    done: '✓ 完了'
  }

  const r = results[selectedResult]

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="pg-title">発信コンテンツ生成</div>
        <button onClick={() => { setShowHistory(!showHistory); fetchHistory() }} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          {showHistory ? '← 生成に戻る' : '📚 過去の企画履歴'}
        </button>
      </div>
      <div className="pg-sub">企画 → 編集 → 執筆の3エージェントがMTGから発信コンテンツを自動生成します</div>

      {/* 履歴ビュー */}
      {showHistory && (
        <div>
          {history.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--muted)', fontSize: 12 }}>履歴がありません</div>
          ) : (
            history.map((h: any, i: number) => (
              <div key={i} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{h.date}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{h.fileNames?.join(', ')}</div>
                </div>
                {h.plans?.map((p: any, j: number) => (
                  <div key={j} style={{ background: 'var(--bg)', borderRadius: 4, padding: '6px 10px', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{p.title}</span>
                    <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{p.target}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {!showHistory && <>
      {/* ステップインジケーター */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
        {(['input','planning','editing','writing','done'] as const).map((s, i) => {
          const steps = ['input','planning','editing','writing','done']
          const current = steps.indexOf(step)
          const thisIdx = steps.indexOf(s)
          const isDone = thisIdx < current
          const isActive = s === step
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                background: isActive ? 'var(--ink)' : isDone ? 'var(--gbg)' : 'var(--bg)',
                color: isActive ? '#fff' : isDone ? 'var(--green)' : 'var(--muted)',
                border: `0.5px solid ${isActive ? 'var(--ink)' : isDone ? 'var(--green)' : 'var(--b1)'}`
              }}>{stepLabel[s]}</div>
              {i < 4 && <div style={{ width: 12, height: 0.5, background: 'var(--b1)' }} />}
            </div>
          )
        })}
      </div>

      {/* STEP1: 入力 */}
      {step === 'input' && (
        <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16 }}>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); readFiles(Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.md') || f.name.endsWith('.txt') || f.name.endsWith('.pdf'))) }}
            style={{ border: `1px dashed ${dragging ? 'var(--ink)' : 'var(--b1)'}`, borderRadius: 'var(--r)', padding: 20, textAlign: 'center' as const, cursor: 'pointer', marginBottom: 10, background: dragging ? 'var(--bg)' : 'transparent', transition: 'all 0.15s' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>📄</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>ファイルをクリックして選択</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>.md / .txt / .pdf 対応 — 複数選択可</div>
            <input ref={fileRef} type="file" accept=".md,.txt,.pdf" multiple style={{ display: 'none' }} onChange={handleFile} />
          </div>
          {fileNames.length > 0 && <div style={{ marginBottom: 8 }}>{fileNames.map((name, i) => <span key={i} style={{ fontSize: 10, background: 'var(--gbg)', color: 'var(--green)', padding: '2px 8px', borderRadius: 10, marginRight: 4 }}>✓ {name}</span>)}</div>}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>またはテキストを直接貼り付け</label>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="MTG議事録を貼り付けてください..." style={{ ...inp, minHeight: 140, resize: 'vertical' as const }} />
          {error && <div style={{ color: 'var(--red)', fontSize: 12, margin: '8px 0' }}>{error}</div>}
          <button onClick={runPlanning} disabled={loading} style={{ width: '100%', marginTop: 10, padding: 10, background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            🎯 企画エージェントを起動する
          </button>
        </div>
      )}

      {/* STEP2: 企画結果 */}
      {step === 'planning' && !loading && plans.length > 0 && (
        <div>
          <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>企画エージェントの出力 — {plans.length}件</div>
            {plans.map((p, i) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>企画{i+1}: {p.title}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[['想定読者', p.target], ['切り口', p.angle], ['伝えたい核心', p.point]].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('input')} style={{ padding: '8px 16px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>← やり直す</button>
            <button onClick={runEditing} disabled={loading} style={{ flex: 1, padding: 10, background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✍️ 編集エージェントに渡す
            </button>
          </div>
        </div>
      )}

      {/* STEP3: 編集結果 */}
      {step === 'editing' && !loading && editedPlans.length > 0 && (
        <div>
          <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>編集エージェントの出力</div>
            {editedPlans.map((p, i) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>企画{i+1}: {p.title}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>執筆方針</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 10, lineHeight: 1.6 }}>{p.direction}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>✓ OK表現</div>
                    {p.okExpressions.map((ex, j) => <div key={j} style={{ background: 'var(--gbg)', borderRadius: 3, padding: '3px 8px', marginBottom: 4, fontSize: 11 }}>{ex}</div>)}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>✗ NG表現</div>
                    {p.ngExpressions.map((ex, j) => <div key={j} style={{ background: 'var(--rbg)', borderRadius: 3, padding: '3px 8px', marginBottom: 4, fontSize: 11 }}>{ex}</div>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('planning')} style={{ padding: '8px 16px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>← 企画に戻る</button>
            <button onClick={runWriting} disabled={loading} style={{ flex: 1, padding: 10, background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              📝 執筆エージェントに渡す
            </button>
          </div>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 32, textAlign: 'center' as const }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            {step === 'planning' ? '企画エージェントが考えています...' : step === 'editing' ? '編集エージェントがチェックしています...' : '執筆エージェントが書いています...'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>少々お待ちください</div>
        </div>
      )}

      {/* STEP4: 完成 */}
      {step === 'done' && results.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{results.length}件のコンテンツが完成しました</div>
            <button onClick={() => { setStep('input'); setPlans([]); setEditedPlans([]); setResults([]); setText('') }} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>最初からやり直す</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
            {results.map((r, i) => (
              <button key={i} onClick={() => setSelectedResult(i)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: selectedResult === i ? 'var(--ink)' : 'var(--paper)', color: selectedResult === i ? '#fff' : 'var(--ink2)', border: `0.5px solid ${selectedResult === i ? 'var(--ink)' : 'var(--b1)'}` }}>
                テーマ{i+1}: {r.plan.title}
              </button>
            ))}
          </div>
          {r && (
            <div>
              {/* 企画サマリー */}
              <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 8 }}>企画概要</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{r.plan.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>{r.plan.direction}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 10, background: 'var(--bg)', padding: '2px 8px', borderRadius: 10, color: 'var(--ink2)' }}>対象: {r.plan.target}</span>
                  <span style={{ fontSize: 10, background: 'var(--bg)', padding: '2px 8px', borderRadius: 10, color: 'var(--ink2)' }}>切り口: {r.plan.angle}</span>
                </div>
              </div>
              {/* X投稿 */}
              <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>𝕏 投稿文（3パターン）</div>
                {r.content.xPosts.map((post, i) => (
                  <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: 12, marginBottom: 8, position: 'relative' as const }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>パターン{i+1} — {post.length}文字</div>
                    <div style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>{post}</div>
                    <button onClick={() => navigator.clipboard.writeText(post)} style={{ position: 'absolute' as const, top: 10, right: 10, fontSize: 10, padding: '2px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'var(--paper)', cursor: 'pointer', fontFamily: 'inherit' }}>コピー</button>
                  </div>
                ))}
              </div>
              {/* note */}
              <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>note 記事</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{r.content.noteTitle}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>構成</div>
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: 10, marginBottom: 10, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>{r.content.noteOutline}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>本文</div>
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: 12, fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap' as const, position: 'relative' as const }}>
                  {r.content.noteBody}
                  <button onClick={() => navigator.clipboard.writeText(r.content.noteBody)} style={{ position: 'absolute' as const, top: 10, right: 10, fontSize: 10, padding: '2px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'var(--paper)', cursor: 'pointer', fontFamily: 'inherit' }}>コピー</button>
                </div>
              </div>
              {/* OK/NG */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>✓ OK表現</div>
                  {r.plan.okExpressions.map((ex, i) => <div key={i} style={{ background: 'var(--gbg)', borderRadius: 4, padding: '6px 10px', marginBottom: 6, fontSize: 12 }}>{ex}</div>)}
                </div>
                <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>✗ NG表現</div>
                  {r.plan.ngExpressions.map((ex, i) => <div key={i} style={{ background: 'var(--rbg)', borderRadius: 4, padding: '6px 10px', marginBottom: 6, fontSize: 12 }}>{ex}</div>)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </> }
    </div>
  )
}
