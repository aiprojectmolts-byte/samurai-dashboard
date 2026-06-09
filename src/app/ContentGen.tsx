'use client'
import ReactMarkdown from 'react-markdown'
import { useState, useRef } from 'react'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'

interface Plan {
  title: string
  target: string
  angle: string
  point: string
  persona?: string
  stage?: string
  ceoAngle?: string
  needs?: string        // 想定されるニーズ
  userGoal?: string     // ユーザーのゴール・得られる結果
  story?: string        // 必要な要素とストーリー（構成）
  outline?: { heading: string, description: string }[]  // 記事目次
}

interface Expression {
  text: string
  reason?: string
  context?: string
  checkPoint?: string
  judgment: 'OK' | 'NG' | '保留' | ''
}

interface EditedPlan extends Plan {
  okExpressions: string[]
  ngExpressions: string[]
  expressions: Expression[]
  direction: string
  confirmationDoc?: string
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
  const [step, setStep] = useState<'input'|'planning'|'structure'|'editing'|'writing'|'done'>('input')
  const [plans, setPlans] = useState<Plan[]>([])
  const [structuredPlans, setStructuredPlans] = useState<Plan[]>([])
  const [editedPlans, setEditedPlans] = useState<EditedPlan[]>([])
  const [results, setResults] = useState<FinalResult[]>([])
  const [selectedResult, setSelectedResult] = useState(0)
  const [loading, setLoading] = useState(false)
  const [planCount, setPlanCount] = useState(3)
  const [selectedPlanIndices, setSelectedPlanIndices] = useState<Set<number>>(new Set())
  const [writingTab, setWritingTab] = useState<'x' | 'note'>('x')
  const [writingMode, setWritingMode] = useState<'both' | 'x' | 'note'>('both')
  const [publishTarget, setPublishTarget] = useState<'kato_note' | 'company_x' | 'both'>('kato_note')
  const [selectedHistoryPlans, setSelectedHistoryPlans] = useState<any[]>([])
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState('')
  const [copiedDocIdx, setCopiedDocIdx] = useState<number | null>(null)

  const copyDoc = async (idx: number, doc: string) => {
    try {
      await navigator.clipboard.writeText(doc)
      setCopiedDocIdx(idx)
      setTimeout(() => setCopiedDocIdx(c => c === idx ? null : c), 2000)
    } catch {}
  }

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
  const mdToHtml = (text: string) => text
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:20px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:14px 0 6px">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0 3px 20px;line-height:1.7">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin:10px 0">')
    .replace(/\n/g, '<br/>')

  const exportPDF = (title: string, sections: {heading: string, body: string}[]) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const html = sections.map(s =>
      `<h2 style="font-size:15px;font-weight:700;margin:28px 0 10px;color:#111;border-bottom:1px solid #ddd;padding-bottom:6px">${s.heading}</h2><div style="font-size:13px;line-height:1.9;color:#333"><p style="margin:10px 0">${mdToHtml(s.body)}</p></div>`
    ).join('<hr style="border:none;border-top:1px solid #eee;margin:24px 0">')
    printWindow.document.write(`<html><head><title>${title}</title><style>body{font-family:'Hiragino Sans','Noto Sans JP',sans-serif;padding:40px;font-size:13px;line-height:1.8;max-width:800px;margin:0 auto}h1{font-size:22px;font-weight:700;margin-bottom:28px;border-bottom:2px solid #333;padding-bottom:10px}@media print{body{padding:20px}}</style></head><body><h1>${title}</h1>${html}</body></html>`)
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
  const writingSections = (rs: typeof results, mode: 'both' | 'x' | 'note' = 'both') => rs.flatMap(r => {
    const sections = []
    if (mode !== 'note') sections.push({ heading: `【${r.plan.title}】X投稿文`, body: (r.content.xPosts || []).join('\n\n---\n\n') })
    if (mode !== 'x') sections.push({ heading: `【${r.plan.title}】note: ${r.content.noteTitle}`, body: r.content.noteBody || '' })
    return sections
  })

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

      const persona = data
        .filter((k: any) => k.label === '加藤CEOペルソナ')
        .slice(0, 3)
        .map((k: any) => `${k.title || ''}: ${k.summary || k.text?.slice(0, 500) || ''}`)
        .join('\n\n')

      const companyBackground = data
        .filter((k: any) => ['参考資料', '会社情報', '自社背景'].includes(k.label))
        .slice(0, 5)
        .map((k: any) => `【${k.title || k.filename}】${k.summary || k.text?.slice(0, 200) || ''}`)
        .join('\n')

      return { voices, background: companyBackground || background, competitive, persona }
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

  const syncToSheets = async (append = false) => {
    setSyncing(true)
    setSyncResult('')
    try {
      const res = await fetch('/api/sync-ng-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ append })
      })
      const data = await res.json()
      if (data.success) {
        setSyncResult(`✓ ${data.synced}件を${append ? '追記' : '上書き'}同期しました`)
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
          reason: ex.context || ex.checkPoint || ex.reason || '',
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

  // ナレッジ内の固有名詞を一般表現に置き換える。失敗時は元テキストをそのまま返す。
  const sanitizeKnowledge = async (text: string): Promise<string> => {
    if (!text || !text.trim()) return text
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `以下のテキストから、具体的な固有名詞を一般的な表現に置き換えてください。

置き換えの対象：
・企業名・クライアント名 → 「あるクライアント企業」「大手デベロッパー」「中小工務店の一社」など文脈に合った一般表現
・競合プロダクト名・サービス名 → 「類似の競合プロダクト」「他社のAIツール」など
・個人名 → 「担当者」「先方の責任者」など

置き換えてはいけないもの：
・SAMURAI ARCHITECTS・Rendery・knock knock AIなどSAMURAI自身のプロダクト名
・数値・パーセンテージ・期間などの具体的なデータ
・業界名・職種名・一般的な技術用語

内容・インサイト・文脈はそのまま保持すること。
テキストが空の場合はそのまま返すこと。
変換後のテキストのみ返すこと。前置き・説明は不要。

テキスト：
${text}`
          }]
        })
      })
      const data = await res.json()
      const out = data.content?.find((c: any) => c.type === 'text')?.text || ''
      return out.trim() || text
    } catch {
      return text
    }
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
      if (text.trim()) saveToKnowledge(text, fileNames)
      await fetchHistory()
      const knowledge = await fetchKnowledgeByLabel()
      // 固有名詞のサニタイズ（voices・competitiveのみ。空なら実行しない）
      const sanitizedVoices = knowledge.voices
        ? await sanitizeKnowledge(knowledge.voices)
        : ''
      const sanitizedCompetitive = knowledge.competitive
        ? await sanitizeKnowledge(knowledge.competitive)
        : ''
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
渡された資料・データから外部発信すべきテーマを抽出します。${pastNgForPlanning}

【加藤CEOの発信テーマ軸（必ず反映すること）】
- 建築業界はまだ「ポケベル」の時代。ポケベル→ガラケー→スマホという段階で、今はガラケーとスマホが混在する過渡期
- バックキャスト設計：イメージ→図面→建材という逆算型の設計プロセスへの移行
- 中小工務店・設計事務所の「味方になりたい」。家業が建設業で、そこへの課題感から起業
- システムだけでは業界は変わらない。ワークフロー・人材育成・ブランディングまで含めた伴走が必要
- 空間デザインの民主化：専門家でなくても高品質な設計提案ができる世界を作る
- カタチ（建築）× 施策（経営）の二項融合。ハードとソフト、両方の視点を持つ
- 変革の受け入れは半分程度。「どっちの意見も分かる」という姿勢で語る

【ターゲットペルソナと態度】
以下の3ペルソナ × 7態度のどのマスに向けた企画かを必ず明示すること。

ペルソナ：
・中小工務店経営者：現場優先、デジタル苦手意識あり、即効性・コスト重視
・設計事務所経営者：クリエイティブ重視、品質意識高、新技術への好奇心あり
・大手ディベロッパーDX担当者：組織的意思決定、ROI・スケール重視

態度（フェーズ）：
・日常：課題をまだ認識していない
・課題認知：何か問題があると感じ始めた
・きっかけ：SAMURAIの存在を知った
・自分事化：自分に関係あると感じた（★最も刺さる山場）
・比較検討：他の選択肢と比べている
・商談・アポ：具体的な話を始めている
・導入・伴走：使い始めた・継続中

【加藤CEO視点の入れ方】
テーマ軸を「必ず1つ選べ」という制約はかけない。
ただし、この企画で加藤CEOがどういう角度・比喩・語り口で語るかを
ceoAngle フィールドに必ず言語化すること。
「汎用ビジネス記事的な表現」ではなく、
加藤CEO個人が語っていると分かる視点を入れること。

【切り口・核心に必ず入れること】
加藤CEO個人の動機・原体験を切り口または核心に組み込むこと。
使える原体験：
・家業が工務店であること
・その現場で感じた課題感・歯痒さから起業したこと
・「中小工務店の味方になりたい」という動機
・「カタチ（建築）だけでは不十分。施策（経営・組織）との融合が必要」という思想

「なぜ私がこれをやっているのか」が伝わる角度で切り口を作ること。
これがない企画はnoteとして加藤CEO個人の発信にならない。
angle または ceoAngle に必ずこの視点を反映すること。

【切り口・核心に使ってはいけない情報】
以下は外部発信不可の社内情報のため、切り口・核心・タイトルに含めないこと：
・組織変更・子会社設立・分社化などの内部事業計画
・導入中または検討中のツール・システム名（Salesforce・PostHog等）
・未発表のパートナーシップ・取引先名
・特定クライアント名・顧客名
これらが切り口に入りそうな場合は「業界全体の課題」「一般的な組織変革」として
抽象化して表現すること。

【発信媒体：${publishTarget === 'kato_note' ? '加藤CEO個人note' : publishTarget === 'company_x' ? '会社公式X' : '加藤CEO個人note + 会社公式X'}】
${publishTarget === 'kato_note' ? `
→ 加藤CEO個人の思想・原体験・比喩を前面に出す企画
→ 会社の実績・数値は「根拠」として使う
→ 「なぜ自分がこれをやっているのか」という一人称の文脈を必ず組み込む
→ 読者：業界に問題意識を持つ建築家・工務店経営者・DX担当者` : publishTarget === 'company_x' ? `
→ 会社としての実績・数値・事例を中心にした企画
→ 短く刺さるトピック・業界インサイトが中心
→ 加藤CEOらしい視点（比喩・現場感）で締める
→ 読者：建築DXに関心のある業界関係者` : `
→ 加藤CEO個人noteと会社Xの両方で使える企画
→ 個人の思想と会社の実績を両方組み込む`}

以下の3層の情報を統合して企画を作ってください：
1. 現場の生の声（商談・MTG）→ 差別化の核心になる
2. 自社の背景・強み → 文脈と信頼性
3. 競合情報 → 差別化ポイント

「現場で語られた課題 × 自社の強み × 競合との差 × 加藤CEOの発信テーマ軸」が交差する企画が最も価値が高いです。
NG表現が企画タイトル・切り口・核心に含まれていないことを必ず確認してください。
特定の企業名・顧客名・個人名は使わないこと。業界・市場・ターゲット層として抽象化すること。
JSONのみ返してください：{"plans":[{"title":"企画タイトル","target":"想定読者","angle":"切り口・視点","point":"伝えたい核心","persona":"中小工務店経営者 | 設計事務所経営者 | 大手ディベロッパーDX担当者 のいずれか","stage":"日常 | 課題認知 | きっかけ | 自分事化 | 比較検討 | 商談・アポ | 導入・伴走 のいずれか","ceoAngle":"この企画で使う加藤CEO的な視点・比喩・語り口を1〜2文で"}]}`,
        `以下の情報から発信企画を${planCount}つ考えてください。${pastPlans}

【今回の入力資料】
${text.slice(0, 3000)}

${sanitizedVoices ? `【現場の生の声（商談・MTG議事録）】
${sanitizedVoices}` : ''}

${knowledge.background ? `【自社背景・参考資料】
${knowledge.background}` : ''}

${knowledge.persona ? `【加藤CEOの発信ペルソナ・実績】
${knowledge.persona}` : ''}

${sanitizedCompetitive ? `【競合情報】
${sanitizedCompetitive}` : ''}`
      )
      setPlans(result.plans)
    } catch (e) {
      setError('企画生成に失敗しました。'); setStep('input')
    } finally {
      setLoading(false)
    }
  }

  // STEP2: 編集エージェント
  // STEP2: 構成エージェント
  const runStructure = async () => {
    setError(''); setLoading(true); setStep('structure')
    try {
      const selectedPlans = plans.filter((_, i) => selectedPlanIndices.has(i))
      const batchSize = 3
      const all: any[] = []
      for (let i = 0; i < selectedPlans.length; i += batchSize) {
        const batch = selectedPlans.slice(i, i + batchSize)
        const batchResult = await callClaude(
          `あなたはSAMURAI ARCHITECTSのコンテンツ構成担当AIです。
以下の企画骨子をもとに記事の構成を設計してください。

JSONのみ返してください：
{"structuredPlans":[{
  "title": "（企画タイトルをそのまま）",
  "needs": "この記事が解決する読者のニーズ・悩み（1〜2文）",
  "userGoal": "記事を読み終えた読者が得られる最高の結果・変化（1〜2文）",
  "story": "ゴールに到達するために必要な要素と記事の流れ（3〜5点・箇条書き）",
  "outline": [
    {"heading": "見出しテキスト", "description": "この節で伝えること（1文）"}
  ]
}]}

企画骨子：${JSON.stringify(batch)}`,
          JSON.stringify(batch)
        )
        all.push(...(batchResult.structuredPlans || []))
      }
      // 構成フィールドを元の企画にマージ（タイトルで照合）
      const merged: Plan[] = selectedPlans.map(p => {
        const s = all.find((x: any) => x.title === p.title) || {}
        return { ...p, needs: s.needs || '', userGoal: s.userGoal || '', story: s.story || '', outline: Array.isArray(s.outline) ? s.outline : [] }
      })
      setStructuredPlans(merged)
    } catch (e) {
      setError('構成生成に失敗しました。'); setStep('planning')
    } finally {
      setLoading(false)
    }
  }

  const runEditing = async () => {
    setError(''); setLoading(true); setStep('editing')
    try {
      // 過去のNG表現を取得
      const exRes = await fetch('/api/content-expressions')
      const exData = await exRes.json()
      const pastNg = exData.length > 0
        ? `\n\n【蓄積されたNG表現（必ず避けてください）】\n${[...new Set(exData.flatMap((e: any) => (e.items || []).filter((i: any) => i.judgment === 'NG').map((i: any) => i.expression || '')))].filter(Boolean).slice(0, 30).map((s: any) => `・${s}`).join('\n')}`
        : ''
      // 構成エージェントの出力（構成フィールド付き）を編集対象にする
      const selectedPlans = structuredPlans
      const batchSize = 3
      const allEditedPlans: any[] = []
      for (let i = 0; i < selectedPlans.length; i += batchSize) {
        const batch = selectedPlans.slice(i, i + batchSize)
        const batchResult = await callClaude(
          `あなたはSAMURAI ARCHITECTSの編集担当AIです。${pastNg}

企画案をもとに2つのことをしてください。
1. この企画で使う表現候補の中から、加藤CEOに確認が必要なものを3〜5件選ぶ
2. 加藤CEOに送る確認用ドキュメントを生成する

【確認が必要な表現の選び方】
以下の基準に当てはまる表現を優先して選んでください：
① 業界を批判・否定的に見ているように読まれかねない表現
  （例：昭和型・遅れている・デジタル音痴・古い慣習・取り残された）
② 強い主張・断定的な言い回し
  （例：〜は不可能・〜の時代は終わった・〜しなければ生き残れない）
③ 概念ラベル系のキーワード
  （例：民主化・革命・破壊的・ゲームチェンジャー）
④ 過去にNGとされた表現に近い言い回し

3〜5件に絞ること。多すぎると確認する側の負担になる。

【その他のルール】
- 業界を否定・見下す表現は避ける（例：「昭和的」「デジタル音痴」「遅れている」）
- 変革・進化・可能性を前向きに表現する
- 加藤CEO個人の言葉として自然な表現にする

JSONのみ返してください：
{
  "editedPlans": [{
    "title": "",
    "target": "",
    "angle": "",
    "point": "",
    "direction": "執筆方針（1〜2文）",
    "expressions": [
      {
        "text": "確認が必要な表現",
        "context": "この表現をどの文脈・場面で使うか",
        "checkPoint": "この表現を、この文脈で使ってOKか。NG・要修正であれば言い換え案を教えてほしい、という1文のみ"
      }
    ],
    "confirmationDoc": "加藤CEOへの確認依頼文（プレーンテキスト）"
  }]
}

checkPoint は「この表現・この言い回しを、この文脈で使ってOKか」だけを問う1文にすること。
構成の判断・執筆方針・フォロー範囲など、表現の是非以外の内容を確認ポイントに含めないこと。
加藤CEOに確認してもらうのは「この表現・この言い回しはOKか」だけに絞ること。

confirmationDoc は以下のフォーマットで生成：
---
📋 企画確認依頼

【企画骨子】
タイトル案：{title}
ターゲット：{target}
切り口：{angle}
伝えたい核心：{point}
加藤CEO視点：{ceoAngle}

【使いたい表現・確認ポイント】
（expressionsの各項目を番号付きで）
① {text}
　この文脈：{context}
　確認：{checkPoint}

確認のお願い：
上記の企画でこれらの表現を使う予定です。
各表現について「OK / NG / 言い換え案」でご確認いただけますか？
---
markdownは使わない。記号は①②③と・のみ。`,
          JSON.stringify(batch)
        )
        allEditedPlans.push(...(batchResult.editedPlans || []))
      }
      const plansWithJudgment = allEditedPlans.map((p: any) => {
        // 構成エージェントの構成フィールドをタイトルで照合してマージ（編集出力には無いため保持）
        const src = structuredPlans.find(sp => sp.title === p.title) || {}
        return {
          ...src,
          ...p,
          expressions: (p.expressions || []).map((ex: any) => ({
            text: typeof ex === 'string' ? ex : ex.text,
            context: typeof ex === 'string' ? '' : (ex.context || ''),
            checkPoint: typeof ex === 'string' ? '' : (ex.checkPoint || ''),
            judgment: ''
          })),
          confirmationDoc: p.confirmationDoc || '',
          okExpressions: p.okExpressions || [],
          ngExpressions: p.ngExpressions || []
        }
      })
      setEditedPlans(plansWithJudgment)
      await saveExpressions(allEditedPlans)
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
      const writingInstruction = writingMode === 'x'
        ? 'X投稿文3パターンのみ生成してください。note記事は不要です。'
        : writingMode === 'note'
        ? 'note記事のみ生成してください。X投稿は不要です。noteTitle・noteBodyのみ返してください。'
        : 'X投稿文3パターンとnote記事を両方生成してください。'
      const result = await callClaude(
        `あなたはSAMURAI ARCHITECTSの加藤利基CEOとして執筆する担当AIです。
加藤CEOの一人称（「私は」「私たちは」）で、文語体で書いてください。

【加藤CEOの思考パターン】
- 比喩で業界を説明する（例：「建築業界はまだポケベルの時代かもしれない」「ガラケーからスマホへの切り替え期」）
- 個人的な原体験を根拠にする（家業が建設業、そこへの課題感から起業した）
- 両論を認めながら前に進む（「どちらの意見も分かる。ただ、現実として〜」）
- 業界への敬意を忘れない（批判ではなく「ポテンシャルが高い」「味方になりたい」）
- 現場の実感を起点にする（「システムを作ってきたからこそ分かること」）
- 断定より観察（「〜な印象がある」「〜だと感じている」「〜のではないだろうか」）

【note文体ルール】
- 書き出し：業界の現状を数字で引用するか、結論を先に出す
- 見出し：疑問形（「なぜ〜か？」）または概念命名型を使う
- 段落：3〜5文を基本。結論部だけ1〜2文の短い段落を挟んで強調する
- 語尾：「〜である」「〜と言える」「〜のではないだろうか」を基調にする
- 締め：「継続宣言型」か「次への引き型」で終わる。CTAは使わない
- マークダウン形式（##見出し、**太字**を適切に使う）
- 語尾は「〜です」「〜ます」「〜ではないでしょうか」「〜と感じています」に統一する
- 「〜である」「〜だ」体は使わない
- 口語・話し言葉は使わない

${writingInstruction}
JSONのみ返してください：{"results":[{"xPosts":["X投稿1(140文字以内)","X投稿2(140文字以内)","X投稿3(140文字以内)"],"noteTitle":"noteタイトル","noteBody":"note本文800〜1200文字（マークダウン形式）"}]}`,
        `以下の編集済み企画案をもとにコンテンツを執筆してください：\n${JSON.stringify(editedPlans, null, 2)}`
      )
      const finalResults = editedPlans.map((plan, i) => ({
        plan,
        content: result.results[i] || result.results[0]
      }))
      setResults(finalResults)
      setStep('done')
      setSelectedResult(0)
      setWritingTab(writingMode === 'note' ? 'note' : 'x')
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
    structure: '③ 構成エージェント',
    editing: '④ 編集エージェント',
    writing: '⑤ 執筆エージェント',
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
      <div className="pg-sub">企画 → 構成 → 編集 → 執筆の4エージェントがMTGから発信コンテンツを自動生成します</div>

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
                {h.plans?.map((p: any, j: number) => {
                  const key = `${i}-${j}`
                  const isSelected = selectedHistoryPlans.some(s => s._key === key)
                  return (
                    <div key={j} onClick={() => setSelectedHistoryPlans(prev => isSelected ? prev.filter(s => s._key !== key) : [...prev, { ...p, _key: key }])}
                      style={{ background: isSelected ? 'var(--gbg)' : 'var(--bg)', borderRadius: 4, padding: '6px 10px', marginBottom: 6, fontSize: 12, cursor: 'pointer', border: isSelected ? '1px solid var(--green)' : '1px solid transparent', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--b1)', background: isSelected ? 'var(--green)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isSelected && <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div>
                        <span style={{ fontWeight: 600 }}>{p.title}</span>
                        <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{p.target}</span>
                      </div>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={() => exportPDF(`企画_${h.date}`, (h.plans || []).map((p: any) => ({ heading: p.title, body: `想定読者: ${p.target}\n切り口: ${p.angle}\n核心: ${p.point}` })))} style={{ fontSize: 10, padding: '2px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>📄 PDF</button>
                  <button onClick={() => exportWord(`企画_${h.date}`, (h.plans || []).map((p: any) => ({ heading: p.title, body: `想定読者: ${p.target}\n切り口: ${p.angle}\n核心: ${p.point}${p.direction ? '\n執筆方針: ' + p.direction : ''}` })))} style={{ fontSize: 10, padding: '2px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>📝 Word</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showHistory && selectedHistoryPlans.length > 0 && (
        <div style={{ position: 'sticky', bottom: 0, padding: '12px 0', background: 'var(--bg)' }}>
          <button onClick={() => { setPlans(selectedHistoryPlans.map(({_key, ...p}) => p)); setSelectedPlanIndices(new Set(selectedHistoryPlans.map((_, i) => i))); setShowHistory(false); setStep('planning') }}
            style={{ width: '100%', padding: 10, background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✍️ 選択した{selectedHistoryPlans.length}件を編集に渡す
          </button>
        </div>
      )}

      {!showHistory && <>
      {/* ステップインジケーター */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
        {(['input','planning','structure','editing','writing','done'] as const).map((s, i) => {
          const steps = ['input','planning','structure','editing','writing','done']
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
              {i < 5 && <div style={{ width: 12, height: 0.5, background: 'var(--b1)' }} />}
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
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>発信媒体</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([['kato_note', '✍️ 加藤CEO個人note'], ['company_x', '𝕏 会社公式X'], ['both', '両方']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setPublishTarget(val as any)}
                  style={{ padding: '4px 12px', borderRadius: 20, border: '0.5px solid var(--b1)', background: publishTarget === val ? 'var(--ink)' : 'none', color: publishTarget === val ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
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
              <div key={i} onClick={() => setSelectedPlanIndices(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })}
                style={{ background: selectedPlanIndices.has(i) ? 'var(--gbg)' : 'var(--bg)', borderRadius: 'var(--r)', padding: 12, marginBottom: 8, cursor: 'pointer', border: selectedPlanIndices.has(i) ? '1px solid var(--green)' : '1px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 3, border: '1.5px solid var(--b1)', background: selectedPlanIndices.has(i) ? 'var(--green)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selectedPlanIndices.has(i) && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>企画{i+1}: {p.title}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[['想定読者', p.target], ['切り口', p.angle], ['伝えたい核心', p.point]].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{val}</div>
                    </div>
                  ))}
                </div>
                {(p.persona || p.stage || p.ceoAngle) && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--b1)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {p.persona && <div style={{ fontSize: 11 }}><span style={{ fontWeight: 600, color: 'var(--muted)' }}>ペルソナ：</span><span style={{ color: 'var(--ink2)' }}>{p.persona}</span></div>}
                    {p.stage && <div style={{ fontSize: 11 }}><span style={{ fontWeight: 600, color: 'var(--muted)' }}>フェーズ：</span><span style={{ color: 'var(--ink2)' }}>{p.stage}</span></div>}
                    {p.ceoAngle && <div style={{ fontSize: 11 }}><span style={{ fontWeight: 600, color: 'var(--muted)' }}>加藤CEO視点：</span><span style={{ color: 'var(--ink2)' }}>{p.ceoAngle}</span></div>}
                  </div>
                )}
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
            <button onClick={runStructure} disabled={loading || selectedPlanIndices.size === 0} style={{ flex: 1, padding: 10, background: selectedPlanIndices.size > 0 ? 'var(--ink)' : 'var(--muted)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: selectedPlanIndices.size > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              🧩 選択した{selectedPlanIndices.size}件を構成
            </button>
          </div>
        </div>
      )}

      {/* STEP: 構成結果 */}
      {step === 'structure' && !loading && structuredPlans.length > 0 && (
        <div>
          <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>構成エージェントの出力</div>
            {structuredPlans.map((p, i) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>企画{i+1}: {p.title}</div>
                {p.needs && <><div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>想定されるニーズ</div><div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8, lineHeight: 1.6 }}>{p.needs}</div></>}
                {p.userGoal && <><div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>ゴール・得られる結果</div><div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8, lineHeight: 1.6 }}>{p.userGoal}</div></>}
                {p.story && <><div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>要素とストーリー</div><div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>{p.story}</div></>}
                {p.outline && p.outline.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>記事目次</div>
                    {p.outline.map((o, j) => (
                      <div key={j} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 4, padding: '6px 10px', marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{j+1}. {o.heading}</div>
                        {o.description && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{o.description}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('planning')} style={{ padding: '8px 16px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>← 企画に戻る</button>
            <button onClick={runEditing} disabled={loading} style={{ flex: 1, padding: 10, background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✍️ 編集エージェントへ進む
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
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink2)', marginBottom: 6 }}>加藤CEOに確認が必要な表現（OK/NG/保留を選択してください）</div>
                {(p.expressions || []).map((ex: any, j: number) => (
                  <div key={j} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 4, padding: '8px 10px', marginBottom: 6, fontSize: 11 }}>
                    <div style={{ marginBottom: 4, fontWeight: 600 }}>{ex.text}</div>
                    {ex.context && <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>この文脈：{ex.context}</div>}
                    {ex.checkPoint && <div style={{ fontSize: 10, color: 'var(--ink2)', marginBottom: 6 }}>確認：{ex.checkPoint}</div>}
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
                {p.confirmationDoc && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink2)', letterSpacing: '0.04em' }}>📋 加藤CEO確認用ドキュメント</div>
                      <button onClick={() => copyDoc(i, p.confirmationDoc || '')}
                        style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, border: '0.5px solid ' + (copiedDocIdx === i ? 'var(--green)' : 'var(--b1)'), background: copiedDocIdx === i ? 'var(--gbg)' : 'var(--paper)', color: copiedDocIdx === i ? 'var(--green)' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {copiedDocIdx === i ? '✓ コピーしました' : '📋 コピー'}
                      </button>
                    </div>
                    <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 4, padding: '10px 12px', fontSize: 11, lineHeight: 1.7, color: 'var(--ink)', whiteSpace: 'pre-wrap' as const }}>{p.confirmationDoc}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* 表現にOK/NGを付けた後にスプレッドシートへ同期する */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <button onClick={() => syncToSheets(false)} disabled={syncing} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink2)' }}>
              {syncing ? '同期中...' : '📊 上書き同期'}
            </button>
            <button onClick={() => syncToSheets(true)} disabled={syncing} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink2)' }}>
              {syncing ? '同期中...' : '📊 追記同期'}
            </button>
            {syncResult && <span style={{ fontSize: 11, color: syncResult.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{syncResult}</span>}
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={async () => { await saveToHistory(editedPlans, new Date().toLocaleDateString('ja-JP')); await saveExpressions(editedPlans); alert('編集結果を保存しました') }} style={{ padding: '6px 12px', border: '0.5px solid var(--green)', borderRadius: 'var(--r)', background: 'var(--gbg)', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600 }}>💾 編集結果を保存</button>
            <button onClick={() => exportPDF('企画・編集チェック', editSections(editedPlans))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📄 PDF出力</button>
            <button onClick={() => exportWord('企画・編集チェック', editSections(editedPlans))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📝 Word出力</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('structure')} style={{ padding: '8px 16px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>← 構成に戻る</button>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {(['both', 'x', 'note'] as const).map(mode => (
                <button key={mode} onClick={() => setWritingMode(mode)}
                  style={{ padding: '4px 12px', borderRadius: 20, border: '0.5px solid var(--b1)', background: writingMode === mode ? 'var(--ink)' : 'none', color: writingMode === mode ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
                  {mode === 'both' ? 'X + note' : mode === 'x' ? '𝕏 Xのみ' : '📝 noteのみ'}
                </button>
              ))}
            </div>
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
            {step === 'planning' ? '企画エージェントが考えています...' : step === 'structure' ? '構成エージェントが設計しています...' : step === 'editing' ? '編集エージェントがチェックしています...' : '執筆エージェントが書いています...'}
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
            <button onClick={() => { const t = writingMode==='note'&&results[selectedResult]?.content?.noteTitle||'発信コンテンツ一式'; exportPDF(t, writingSections(results, writingMode)) }} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📄 PDF出力</button>
            <button onClick={() => { const t = writingMode==='note'&&results[selectedResult]?.content?.noteTitle||'発信コンテンツ一式'; exportWord(t, writingSections(results, writingMode)) }} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📝 Word出力</button>
            <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setStep('input'); setPlans([]); setStructuredPlans([]); setEditedPlans([]); setResults([]); setText('') }} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>最初からやり直す</button>
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
              {/* X/note タブ切り替え */}
              <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {(['x', 'note'] as const).map(tab => (
                    <button key={tab} onClick={() => setWritingTab(tab)}
                      style={{ padding: '4px 14px', borderRadius: 20, border: '0.5px solid var(--b1)', background: writingTab === tab ? 'var(--ink)' : 'none', color: writingTab === tab ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600 }}>
                      {tab === 'x' ? '𝕏 X投稿' : '📝 note'}
                    </button>
                  ))}
                </div>
                {writingTab === 'x' && writingMode !== 'note' && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>𝕏 投稿文（3パターン）</div>
                    {r.content.xPosts.map((post, i) => (
                      <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: 12, marginBottom: 8, position: 'relative' as const }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>パターン{i+1} — {post.length}文字</div>
                        <div style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>{post}</div>
                        <button onClick={() => navigator.clipboard.writeText(post)} style={{ position: 'absolute' as const, top: 10, right: 10, fontSize: 10, padding: '2px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'var(--paper)', cursor: 'pointer', fontFamily: 'inherit' }}>コピー</button>
                      </div>
                    ))}
                  </>
                )}
                {writingTab === 'note' && writingMode !== 'x' && (
                  <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '24px 28px', position: 'relative' as const }}>
                    <button onClick={() => navigator.clipboard.writeText(`${r.content.noteTitle}\n\n${r.content.noteBody}`)} style={{ position: 'absolute' as const, top: 12, right: 12, fontSize: 10, padding: '2px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'var(--paper)', cursor: 'pointer', fontFamily: 'inherit' }}>コピー</button>
                    <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.5, marginBottom: 20, paddingRight: 60 }}>{r.content.noteTitle}</h1>
                    <ReactMarkdown components={{
                      h1: ({children}) => <h1 style={{ fontSize: 18, fontWeight: 700, margin: '20px 0 10px', borderBottom: '1px solid var(--b1)', paddingBottom: 6 }}>{children}</h1>,
                      h2: ({children}) => <h2 style={{ fontSize: 15, fontWeight: 700, margin: '16px 0 8px' }}>{children}</h2>,
                      h3: ({children}) => <h3 style={{ fontSize: 13, fontWeight: 700, margin: '12px 0 6px' }}>{children}</h3>,
                      p: ({children}) => <p style={{ margin: '0 0 12px', lineHeight: 1.9, fontSize: 13 }}>{children}</p>,
                      strong: ({children}) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                      ul: ({children}) => <ul style={{ paddingLeft: 20, margin: '4px 0 12px' }}>{children}</ul>,
                      li: ({children}) => <li style={{ marginBottom: 6, lineHeight: 1.8, fontSize: 13 }}>{children}</li>,
                    }}>{r.content.noteBody}</ReactMarkdown>
                  </div>
                )}
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
