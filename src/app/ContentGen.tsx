'use client'
import { useState, useRef } from 'react'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'

interface Plan {
  title: string
  target: string
  angle: string
  point: string
}

interface Expression {
  text: string
  reason: string
  judgment: 'OK' | 'NG' | '保留' | ''
}

interface EditedPlan extends Plan {
  okExpressions: string[]
  ngExpressions: string[]
  expressions: Expression[]
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

const PROMPT_CONTENT = `このドキュメントから、外部発信できる重要なトピックと洞察を抽出してください。
・どんな課題が議論されたか
・どんな知見・意見が出たか
・業界や社会に伝えられる価値のある内容は何か
箇条書きで出力してください。`

const PROMPT_GENERAL = `このドキュメントの要点を構造化してまとめてください。
日付・種類・概要・重要ポイント・キーワードを含めてください。`

export default function ContentGen() {
  const [text, setText] = useState('')
  const [step, setStep] = useState<'input'|'planning'|'editing'|'writing'|'done'>('input')
  const [plans, setPlans] = useState<Plan[]>([])
  const [editedPlans, setEditedPlans] = useState<EditedPlan[]>([])
  const [results, setResults] = useState<FinalResult[]>([])
  const [selectedResult, setSelectedResult] = useState(0)
  const [loading, setLoading] = useState(false)
  const [planCount, setPlanCount] = useState(3)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState('')

  // Word出力
  const exportWord = async (title: string, sections: {heading: string, body: string}[]) => {
    const children: any[] = [
      new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 300 } }),
    ]
    sections.forEach(s => {
      children.push(new Paragraph({ text: s.heading, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }))
      s.body.split('\n').forEach((line: string) => {
        children.push(new Paragraph({ children: [new TextRun({ text: line, size: 24 })], spacing: { after: 80 } }))
      })
    })
    const doc = new Document({ sections: [{ children }] })
    const blob = await Packer.toBlob(doc)
    saveAs(blob, `${title}.docx`)
  }

  // PDF出力
  const exportPDF = (title: string, sections: {heading: string, body: string}[]) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const html = sections.map(s =>
      `<h2>${s.heading}</h2><p style="white-space:pre-wrap">${s.body}</p>`
    ).join('<hr>')
    printWindow.document.write(`<html><head><title>${title}</title><style>body{font-family:'Hiragino Sans','Noto Sans JP',sans-serif;padding:32px;font-size:13px;line-height:1.8;max-width:800px;margin:0 auto}h1{font-size:22px;margin-bottom:24px;border-bottom:2px solid #333;padding-bottom:8px}h2{font-size:15px;margin-top:24px;margin-bottom:8px;color:#333}p{margin:4px 0;color:#444}hr{border:none;border-top:1px solid #eee;margin:20px 0}@media print{body{padding:16px}}</style></head><body><h1>${title}</h1>${html}</body></html>`)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 300)
  }

  // 企画セクションのWord/PDF用テキスト生成
  const planSections = (ps: typeof plans) => ps.flatMap(p => [
    { heading: `企画: ${p.title}`, body: `想定読者: ${p.target}\n切り口: ${p.angle}\n伝えたい核心: ${p.point}` }
  ])

  // 編集セクション
  const editSections = (eps: typeof editedPlans) => eps.flatMap(p => [
    { heading: `企画: ${p.title}`, body: `執筆方針: ${p.direction}\n\nOK表現:\n${p.okExpressions.join('\n')}\n\nNG表現:\n${p.ngExpressions.join('\n')}` }
  ])

  // 執筆セクション
  const writingSections = (rs: typeof results) => rs.flatMap(r => [
    { heading: `【${r.plan.title}】X投稿文`, body: r.content.xPosts.join('\n\n---\n\n') },
    { heading: `【${r.plan.title}】note記事: ${r.content.noteTitle}`, body: `${r.content.noteOutline}\n\n${r.content.noteBody}` }
  ])

  // Word出力
  // PDF出力
  // 企画セクションのWord/PDF用テキスト生成
  // 編集セクション
  // 執筆セクション
  // ラベル別にナレッジを取得
  const fetchKnowledgeByLabel = async () => {
    try {
      const res = await fetch('/api/knowledge')
      const data = await res.json()
      if (!Array.isArray(data)) return { voices: '', trends: '', background: '', competitive: '' }

      const voices = data
        .filter((k: any) => ['MTG議事録', '商談ログ'].includes(k.label))
        .slice(0, 10)
        .map((k: any) => `【業界の現場の声】${k.summary || ''}`.trim()).filter(Boolean)
        .join('\n')

      const background = data
        .filter((k: any) => ['参考資料', '会社情報'].includes(k.label))
        .slice(0, 5)
        .map((k: any) => `【${k.filename}】${k.summary || k.text?.slice(0, 200) || ''}`)
        .join('\n')

      const competitive = data
        .filter((k: any) => k.label === '競合情報' || k.filename?.includes('競合'))
        .slice(0, 5)
        .map((k: any) => `【${k.filename}】${k.summary || k.text?.slice(0, 200) || ''}`)
        .join('\n')

      return { voices, background, competitive }
    } catch {
      return { voices: '', background: '', competitive: '' }
    }
  }

  // ナレッジベースに自動登録
  const saveToKnowledge = async (inputText: string, names: string[]) => {
    try {
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
${inputText.slice(0, 3000)}`
          }]
        })
      })
      const aiData = await aiRes.json()
      const aiText = aiData.content?.[0]?.text || '{}'
      let meta = { label: 'その他', summary: '', date: '' }
      try { meta = JSON.parse(aiText.replace(/\`\`\`json|\`\`\`/g, '').trim()) } catch {}

      await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `kb_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          filename: names.length > 0 ? names.join(', ') : `入力テキスト_${new Date().toLocaleDateString('ja-JP')}`,
          label: meta.label || 'その他',
          summary: meta.summary || '',
          date: meta.date || '',
          text: inputText.slice(0, 10000),
          createdAt: new Date().toISOString()
        })
      })
    } catch (e) { console.error('knowledge save error:', e) }
  }

  const syncToSheets = async () => {
    setSyncing(true)
    setSyncResult('')
    try {
      const res = await fetch('/api/sync-ng-list', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSyncResult(`✓ ${data.synced}件をスプレッドシートに同期しました`)
      } else {
        setSyncResult(`エラー: ${data.error}`)
      }
    } catch (e) {
      setSyncResult('同期に失敗しました')
    }
    setSyncing(false)
  }

  // 履歴読み込み
  const fetchHistory = async () => {
    const res = await fetch('/api/content-plans')
    const data = await res.json()
    setHistory(data)
  }

  // OK/NG表現を企画単位で保存
  const updateJudgment = (planIdx: number, exIdx: number, judgment: string) => {
    setEditedPlans(prev => prev.map((p, pi) => pi !== planIdx ? p : {
      ...p,
      expressions: p.expressions.map((ex: any, ei: number) => ei !== exIdx ? ex : { ...ex, judgment }),
      okExpressions: pi === planIdx
        ? p.expressions.filter((_: any, ei: number) => ei === exIdx && judgment === 'OK').map((e: any) => e.text)
          .concat(p.okExpressions.filter((_: string, ei: number) => true))
        : p.okExpressions,
      ngExpressions: pi === planIdx
        ? p.expressions.filter((_: any, ei: number) => ei === exIdx && judgment === 'NG').map((e: any) => e.text)
          .concat(p.ngExpressions.filter((_: string, ei: number) => true))
        : p.ngExpressions
    }))
  }

  const saveExpressions = async (editedPlans: any[]) => {
    const date = new Date().toLocaleDateString('ja-JP')
    const sessionId = `session_${Date.now()}`
    for (const p of editedPlans) {
      const items = [
        ...(p.expressions || []).map((ex: any) => ({
          expression: ex.text,
          judgment: '',
          reason: ex.reason || '',
          type: '',
          theme: p.title || '',
          target: p.target || '',
          direction: p.direction || '',
          date,
          sessionId
        }))
      ]
      await fetch('/api/content-expressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: (p.okExpressions || []),
          ng: (p.ngExpressions || []),
          sessionId,
          theme: p.title || '',
          target: p.target || '',
          direction: p.direction || '',
          date,
          items
        })
      })
    }
  }

  // 執筆結果を保存
  const saveWritings = async (results: any[]) => {
    await fetch('/api/content-writings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results, date: new Date().toLocaleDateString('ja-JP'), fileNames })
    })
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
        max_tokens: 8000,
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
    const oversized = files.filter(f => f.size > 4 * 1024 * 1024)
    if (oversized.length > 0) {
      setError(`以下のファイルは4MBを超えています。テキストに変換してから貼り付けてください：${oversized.map(f => ` ${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`).join(',')}`)
      return
    }
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
    // テキストは任意（ナレッジがあれば空でも動く）
    setError(''); setLoading(true); setStep('planning')
    try {
      saveToKnowledge(text, fileNames)
      await fetchHistory()
      const knowledge = await fetchKnowledgeByLabel()
      // 蓄積されたNG表現を取得
      const exRes2 = await fetch('/api/content-expressions')
      const exData2 = await exRes2.json()
      const pastNgForPlanning = exData2.length > 0
        ? `\n\n【過去にNGと判定された表現（企画タイトル・切り口に使わないこと）】\n${[...new Set(exData2.flatMap((e: any) => (e.items || []).filter((i: any) => i.judgment === 'NG').map((i: any) => i.expression || '')))]
            .filter(Boolean).slice(0, 30).map((s: any) => `・${s}`).join('\n')}`
        : ''
      const pastPlans = history.length > 0
        ? `\n\n【過去の企画履歴（被りを避けてください）】\n${history.flatMap((h: any) => h.plans || []).map((p: any) => `・${p.title}`).join('\n')}`
        : ''
      const result = await callClaude(
        `あなたはSAMURAI ARCHITECTSの企画担当AIです。
渡された資料・データから「加藤CEOが外部発信すべきテーマ」を抽出します。
建築×AIの文脈で業界に価値を届けられる企画を考えてください。${pastNgForPlanning}

以下の3層の情報を統合して企画を作ってください：
1. 現場の生の声（商談・MTG）→ 差別化の核心になる
2. 自社の背景・強み → 文脈と信頼性
3. 競合情報 → 差別化ポイント

「現場で語られた課題 × 自社の強み × 競合との差」が交差する企画が最も価値が高いです。
NG表現が企画タイトル・切り口・核心に含まれていないことを必ず確認してください。
特定の企業名・顧客名・個人名は企画に使わないこと。業界・市場・ターゲット層として抽象化すること。
JSONのみ返してください：{"plans":[{"title":"企画タイトル","target":"想定読者","angle":"切り口・視点","point":"伝えたい核心"}]}`,
        `以下の情報から発信企画を${planCount}つ考えてください。${pastPlans}

【今回の入力資料】
${text.slice(0, 3000)}

${knowledge.voices ? `【現場の生の声（商談・MTG議事録）】
${knowledge.voices}` : ''}

${knowledge.background ? `【自社背景・参考資料】
${knowledge.background}` : ''}

${knowledge.competitive ? `【競合情報】
${knowledge.competitive}` : ''}`
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
      // 過去のNG表現を取得
      const exRes = await fetch('/api/content-expressions')
      const exData = await exRes.json()
      const pastNg = exData.length > 0
        ? `\n\n【蓄積されたNG表現（必ず避けてください）】\n${[...new Set(exData.flatMap((e: any) => (e.items || []).filter((i: any) => i.judgment === 'NG').map((i: any) => i.expression || '')))].filter(Boolean).slice(0, 30).map((s: any) => `・${s}`).join('\n')}`
        : ''
      const result = await callClaude(
        `あなたはSAMURAI ARCHITECTSの編集担当AIです。${pastNg}
企画案に対して「この企画で使いうる表現候補」を提案してください。判定はしません。
各表現について、なぜこの文脈で有効か・避けるべきかの理由を必ず書いてください。
ルール：
- 業界を否定・見下す表現は避ける（例：「昭和的」「デジタル音痴」「遅れている」）
- 変革・進化・可能性を前向きに表現する
- 加藤CEO個人の言葉として自然な表現にする
JSONのみ返してください：{"editedPlans":[{"title":"","target":"","angle":"","point":"","expressions":[{"text":"表現候補","reason":"この表現を提案する理由・文脈（必須）"}],"okExpressions":[],"ngExpressions":[],"direction":"執筆方針（1〜2文）"}]}`,
        `以下の企画案を編集チェックしてください：\n${JSON.stringify(plans, null, 2)}`
      )
      const plansWithJudgment = result.editedPlans.map((p: any) => ({
        ...p,
        expressions: (p.expressions || []).map((ex: any) => ({
          text: typeof ex === 'string' ? ex : ex.text,
          reason: typeof ex === 'string' ? '' : ex.reason,
          judgment: ''
        })),
        okExpressions: p.okExpressions || [],
        ngExpressions: p.ngExpressions || []
      }))
      setEditedPlans(plansWithJudgment)
      await saveExpressions(result.editedPlans)
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
      await saveWritings(finalResults)
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="pg-title">発信コンテンツ生成</div>
        <button onClick={syncToSheets} disabled={syncing} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink2)' }}>
          {syncing ? '同期中...' : '📊 NGリストをスプシに同期'}
        </button>
      </div>
        <button onClick={() => { setShowHistory(!showHistory); fetchHistory() }} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          {showHistory ? '← 生成に戻る' : '📚 過去の企画履歴'}
        </button>
      </div>
      {syncResult && (
        <div style={{ fontSize: 11, color: syncResult.startsWith('✓') ? 'var(--green)' : 'var(--red)', marginBottom: 8 }}>{syncResult}</div>
      )}
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
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={() => exportPDF(`企画_${h.date}`, (h.plans || []).map((p: any) => ({ heading: p.title, body: `想定読者: ${p.target}\n切り口: ${p.angle}\n核心: ${p.point}` })))} style={{ fontSize: 10, padding: '2px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>📄 PDF</button>
                  <button onClick={() => exportWord(`企画_${h.date}`, (h.plans || []).map((p: any) => ({ heading: p.title, body: `想定読者: ${p.target}\n切り口: ${p.angle}\n核心: ${p.point}${p.direction ? '\n執筆方針: ' + p.direction : ''}` })))} style={{ fontSize: 10, padding: '2px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>📝 Word</button>
                </div>
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
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>.md / .txt / .pdf 対応 — 任意（ナレッジから自動生成）</div>
            <input ref={fileRef} type="file" accept=".md,.txt,.pdf" multiple style={{ display: 'none' }} onChange={handleFile} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button onClick={() => { navigator.clipboard.writeText(PROMPT_CONTENT); alert('コピーしました') }} style={{ fontSize: 10, padding: '3px 10px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink2)' }}>📋 NotebookLM用（コンテンツ生成）</button>
            <button onClick={() => { navigator.clipboard.writeText(PROMPT_GENERAL); alert('コピーしました') }} style={{ fontSize: 10, padding: '3px 10px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink2)' }}>📋 汎用プロンプト</button>
          </div>
          {fileNames.length > 0 && <div style={{ marginBottom: 8 }}>{fileNames.map((name, i) => <span key={i} style={{ fontSize: 10, background: 'var(--gbg)', color: 'var(--green)', padding: '2px 8px', borderRadius: 10, marginRight: 4 }}>✓ {name}</span>)}</div>}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>またはテキストを直接貼り付け</label>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="追加情報があれば貼り付けてください（任意）。ナレッジベースの情報から企画を生成します。" style={{ ...inp, minHeight: 140, resize: 'vertical' as const }} />
          {error && <div style={{ color: 'var(--red)', fontSize: 12, margin: '8px 0' }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ink2)' }}>企画数</span>
            <input type="number" min={1} max={10} value={planCount}
              onChange={e => setPlanCount(Math.min(10, Math.max(1, Number(e.target.value))))}
              style={{ width: 50, padding: '4px 8px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit', textAlign: 'center' as const }}
            />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>最大10</span>
          </div>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={async () => { await saveToHistory(plans, new Date().toLocaleDateString('ja-JP')); alert('企画を保存しました') }} style={{ padding: '6px 12px', border: '0.5px solid var(--green)', borderRadius: 'var(--r)', background: 'var(--gbg)', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600 }}>💾 企画を保存</button>
            <button onClick={() => exportPDF('企画案', planSections(plans))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📄 PDF出力</button>
            <button onClick={() => exportWord('企画案', planSections(plans))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📝 Word出力</button>
          </div>
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
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink2)', marginBottom: 6 }}>表現候補（OK/NG/保留を選択してください）</div>
                    {(p.expressions || []).map((ex: any, j: number) => (
                      <div key={j} style={{ background: 'var(--bg)', borderRadius: 4, padding: '6px 10px', marginBottom: 6, fontSize: 11 }}>
                        <div style={{ marginBottom: 4, fontWeight: 500 }}>{ex.text}</div>
                        {ex.reason && <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>{ex.reason}</div>}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['OK', 'NG', '保留'] as const).map(j2 => (
                            <button key={j2} onClick={() => updateJudgment(i, j, j2)}
                              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '0.5px solid var(--b1)', cursor: 'pointer', fontFamily: 'inherit',
                                background: ex.judgment === j2 ? (j2 === 'OK' ? 'var(--green)' : j2 === 'NG' ? 'var(--red)' : 'var(--ink2)') : 'none',
                                color: ex.judgment === j2 ? '#fff' : 'var(--ink2)'
                              }}>{j2}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={async () => { await saveToHistory(editedPlans, new Date().toLocaleDateString('ja-JP')); await saveExpressions(editedPlans); alert('編集結果を保存しました') }} style={{ padding: '6px 12px', border: '0.5px solid var(--green)', borderRadius: 'var(--r)', background: 'var(--gbg)', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600 }}>💾 編集結果を保存</button>
            <button onClick={() => exportPDF('企画・編集チェック', editSections(editedPlans))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📄 PDF出力</button>
            <button onClick={() => exportWord('企画・編集チェック', editSections(editedPlans))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📝 Word出力</button>
          </div>
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
            <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => exportPDF('発信コンテンツ一式', writingSections(results))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📄 PDF出力</button>
            <button onClick={() => exportWord('発信コンテンツ一式', writingSections(results))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📝 Word出力</button>
            <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => exportPDF('発信コンテンツ一式', writingSections(results))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📄 PDF出力</button>
            <button onClick={() => exportWord('発信コンテンツ一式', writingSections(results))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📝 Word出力</button>
            <button onClick={() => { setStep('input'); setPlans([]); setEditedPlans([]); setResults([]); setText('') }} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>最初からやり直す</button>
          </div>
          </div>
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
