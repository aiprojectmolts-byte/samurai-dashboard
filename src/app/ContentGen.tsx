'use client'
import ReactMarkdown from 'react-markdown'
import { INTERVIEW_EXAMPLES } from './components/interviewExamples'
import { useState, useRef, useEffect } from 'react'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'
import {
  splitBlocks, applyApproved, charDiff, newSuggestionId,
  type ArticleSuggestion,
} from './components/articleSuggestions'

interface Plan {
  title: string
  target: string
  angle: string
  point: string
  persona?: string
  stage?: string
  ceoAngle?: string
  needs?: string        // 想定されるニーズ（旧・後方互換）
  needsManifest?: string // 顕在ニーズ
  needsLatent?: string   // 潜在ニーズ
  userGoal?: string     // ユーザーのゴール・得られる結果
  story?: string        // 必要な要素とストーリー（構成）
  outline?: { heading: string, subheadings?: string[], description?: string }[]  // 記事目次（大見出し＋小見出し）
  // 加藤オーサーシップ（「自分の名前で出したい」を判断するための骨子）
  authorReason?: string   // なぜ加藤がこれを語る必然があるか（使う実体験・原体験）
  readerQuestion?: string // 読者の切実な問い
  readerChange?: string   // 読後に読者がどう変わるか
  trustPath?: string      // なぜ相談・利用したくなるか（信頼の作られ方）
  lead?: string           // 書き出し案（加藤の一人称・声で）
  authorScore?: number    // 加藤が出したい度（0〜100）
  authorNotes?: string    // 出したい理由 / 懸念
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
  articleId?: string  // 提案モードのアンカー先（生成時に採番、保存時に永続化）
}

const PROMPT_CONTENT = `このドキュメントから、外部発信できる重要なトピックと洞察を抽出してください。
・どんな課題が議論されたか
・どんな知見・意見が出たか
・業界や社会に伝えられる価値のある内容は何か
箇条書きで出力してください。`

const PROMPT_GENERAL = `このドキュメントの要点を構造化してまとめてください。
日付・種類・概要・重要ポイント・キーワードを含めてください。`

// 加藤利基ライター人格ブリーフ（正本の写し）。全エージェントの判断の土台として注入する。
// ※ガラケー比喩を"軸"にしない等のガードレールをここに集約し、散在していた人格定義を一元化する。
const DEFAULT_PERSONA = `# 加藤利基ライター人格ブリーフ（全AI生成の判断の土台）

## 役割
SAMURAI ARCHITECTS 代表・加藤利基として書く。目的は売り込みではなく、建築DX領域で「相談先＝侍」という信頼を一本ずつ積むこと。

## 思想の核（本題は必ずここに着地）
- 中小工務店への伴走：家業が工務店で、その現場の課題感から起業。本丸は中小。変革は断罪せず「どっちの意見も分かる」共感者。
- バックキャスト設計：イメージ→図面→建材の逆算で、小規模事務所でも高品質な設計を＝空間デザインの民主化。
- システムだけでは変わらない：俗人的な業界。ワークフロー・人材育成・ブランディングまで含めた伴走。
- 建築家の役割の再定義：デザイン制作だけでなく、空間体験の設計・マーケティング的価値創造へ。
- 二項融合：カタチ（建築）×施策（経営）、ハード×ソフト。
- ミッション：Create a Better Place with Technology。

## 文体
- 加藤の一人称。決意表明調で謙虚。語尾は「〜です／ます／ではないでしょうか／と感じています」。「〜である／だ」体・話し言葉は使わない。
- 抽象ビジョン↔具体数値の往復。断定より観察（「〜という印象がある」「〜のではないだろうか」）。
- 【接地ルール・最重要／特徴でなく厳守の生成規則】抽象的な主張を書いたら、その場で必ず建築・現場の具体（実体験・実データ・建築固有の語＝予算/構造/法規/敷地/納まり/職人調整、外注1週間・5〜20万円→条件次第で数十秒〜数分 等）で裏づける。抽象だけで終わる段落・章を残さない。章ごとに最低1つ具体の一場面を置く。冒頭1行目は読者が実際に口にする"生の一言"から入る（解説調の一般論で始めない）。具体が無ければ創作せず \`[要・加藤確認：具体]\` を残す。
- 原体験（家業・現場・KBS）を根拠にする。

## ガードレール（厳守）
- 比喩（ポケベル→ガラケー→スマホ）は冒頭の"入口の一言"に留め、記事の軸・タイトルにしない。直後に本題（伴走／バックキャスト／民主化）へ折り返す。
- 最大値の誇張をしない。数値は前提・中央値・出典つきで正直に。引用数値は引用と明記する。
- 中小工務店・設計事務所を見下さない・煽らない。
- 守秘：顧客名・商談・未発表の組織情報（子会社構想・Salesforce等）・取引先名は出さず、業界全体の話に抽象化する。
- 機能自慢で終わらせず、必ず社会的意義・思想へ接続して締める。

## 4プロダクト
Rendery（建築特化型画像生成AI）／ knock knock AI（AIホームステージング）／ VISIOAL（空間ビジュアライゼーション）／ カスタムソリューション（AI受託開発）。`

// AIレスポンスの型ゆれに耐える安全アクセサ
const safeText = (v: any): string =>
  v == null ? '' : Array.isArray(v) ? v.map((x: any) => (typeof x === 'string' ? x : (x?.text || x?.heading || ''))).filter(Boolean).join('\n') : (typeof v === 'string' ? v : String(v))
const safeArr = (v: any): any[] => (Array.isArray(v) ? v : [])
const safeBullets = (v: any): string[] => {
  const PH = ''
  // 括弧（全角・半角）内の「・」は分割対象外にするため一時退避
  let depth = 0, masked = ''
  for (const ch of safeText(v)) {
    if (ch === '（' || ch === '(') { depth++; masked += ch }
    else if (ch === '）' || ch === ')') { depth = Math.max(0, depth - 1); masked += ch }
    else masked += (ch === '・' && depth > 0) ? PH : ch
  }
  return masked.split(/\n|・/)
    .map(s => s.split(PH).join('・').trim())   // 退避した「・」を戻す
    .map(s => s.replace(/^【[^】]*】\s*/, '').trim())  // 先頭の【ラベル】を除去
    .filter(Boolean)
}

// AI応答から先頭{〜末尾}を取り出してパース（前後の説明文やコードフェンスに耐える）
const extractJsonObj = (raw: string): any => {
  const t = (raw || '').replace(/```json|```/g, '').trim()
  const s = t.indexOf('{'), e = t.lastIndexOf('}')
  if (s === -1 || e === -1 || e < s) throw new Error('AI応答からJSONを抽出できませんでした')
  return JSON.parse(t.slice(s, e + 1))
}

export default function ContentGen() {
  const [text, setText] = useState('')
  const [step, setStep] = useState<'input'|'planning'|'editing'|'writing'|'done'>('input')
  const [plans, setPlans] = useState<Plan[]>([])
  const [expandedStruct, setExpandedStruct] = useState<Set<number>>(new Set())
  const toggleStruct = (i: number) => setExpandedStruct(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })
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
  // 加藤ライター人格ブリーフ（正本の写し）と、加藤の企画採否
  const [persona, setPersona] = useState(DEFAULT_PERSONA)
  const [verdicts, setVerdicts] = useState<Record<number, 'publish' | 'revise' | 'reject'>>({})
  useEffect(() => {
    fetch('/api/writer-persona').then(r => r.json()).then(d => { if (d?.brief?.trim()) setPersona(d.brief) }).catch(() => {})
  }, [])
  // 人格ブリーフを各エージェントのsystem先頭に注入（散在していた人格定義を一元化）
  const personaBlock = () => `# 参照：加藤利基ライター人格ブリーフ（この思想・文体・ガードレールに必ず従う）\n${(persona || DEFAULT_PERSONA).trim()}\n\n---\n\n`
  // 加藤の採否を記録（"自分の名前で出したい率"を上げる学習信号）
  const saveDecision = async (i: number, verdict: 'publish' | 'revise' | 'reject', p: Plan) => {
    setVerdicts(prev => ({ ...prev, [i]: verdict }))
    const note = (verdict === 'revise' || verdict === 'reject')
      ? (window.prompt(verdict === 'revise' ? 'どこを直したいですか？（任意）' : '却下の理由（任意）') || '')
      : ''
    try {
      await fetch('/api/plan-decisions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey: new Date().toISOString().slice(0, 10) + '::' + (p.title || ''), title: p.title || '', verdict, note, authorScore: p.authorScore ?? null }),
      })
    } catch {}
  }
  const fileRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  // 保存済み記事を提案モードで開く（phase1.5）
  const [showSaved, setShowSaved] = useState(false)
  const [savedArticles, setSavedArticles] = useState<any[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState('')
  const [copiedDocIdx, setCopiedDocIdx] = useState<number | null>(null)
  const [copiedStructIdx, setCopiedStructIdx] = useState<number | null>(null)
  // ユーザーインタビュー記事生成モード
  const [genMode, setGenMode] = useState<'content' | 'interview'>('content')
  const [interviewer, setInterviewer] = useState('')
  const [medium, setMedium] = useState<'corp' | 'kato_note' | 'company_x'>('corp')
  const [companyMode, setCompanyMode] = useState<'with' | 'without'>('with')
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [interviewResult, setInterviewResult] = useState<string | null>(null)
  const [interviewCopied, setInterviewCopied] = useState(false)
  const vttRef = useRef<HTMLInputElement>(null)
  // インタビュー記事の2ステップフロー（骨子生成 → 本文生成）
  const [interviewStep, setInterviewStep] = useState<'setup' | 'outline'>('setup')
  const [outlineLoading, setOutlineLoading] = useState(false)
  const [interviewOutline, setInterviewOutline] = useState<{ titles: string[]; angle: string; sections: { heading: string; summary: string }[] } | null>(null)
  // 記事確認：提案モード（Googleドキュメント方式）
  const [reviewerName, setReviewerName] = useState('')          // 自分（提案者/承認者の実名）
  const [memberNames, setMemberNames] = useState<string[]>([])  // /api/members から取得
  const [suggestions, setSuggestions] = useState<ArticleSuggestion[]>([]) // 表示中記事の提案一覧
  const [previewApproved, setPreviewApproved] = useState(false) // false=元 / true=承認後
  const [sugDraftBlock, setSugDraftBlock] = useState<number | null>(null) // 提案入力を開いているブロック
  const [sugDraftText, setSugDraftText] = useState('')

  // レビュアー候補とローカル保存した自分の名前を初期ロード
  useEffect(() => {
    try { const n = localStorage.getItem('samurai:reviewer-name'); if (n) setReviewerName(n) } catch {}
    fetch('/api/members').then(res => res.json()).then((d: any) => {
      const names = [...(d?.samurai || []), ...(d?.molts || [])].filter((x: string) => x && x !== 'その他')
      setMemberNames(names)
    }).catch(() => {})
  }, [])

  const pickReviewer = (name: string) => {
    setReviewerName(name)
    try { localStorage.setItem('samurai:reviewer-name', name) } catch {}
  }

  // 保存済み記事（content-writings）を articleId 付きでフラットに取得
  const fetchSavedArticles = async () => {
    setSavedLoading(true)
    try {
      const res = await fetch('/api/content-writings')
      const data = await res.json()
      const items: any[] = []
      if (Array.isArray(data)) {
        data.forEach((entry: any) => {
          ;(entry?.results || []).forEach((res2: any) => {
            if (res2 && res2.articleId && res2.content && (res2.content.noteBody || '').trim()) {
              items.push({
                articleId: res2.articleId,
                date: entry.date || '',
                version: entry.version || '',
                fileNames: entry.fileNames || [],
                title: res2.content.noteTitle || res2.plan?.title || '(無題)',
                plan: res2.plan || {},
                content: res2.content,
              })
            }
          })
        })
      }
      setSavedArticles(items)
    } catch {}
    setSavedLoading(false)
  }

  // 保存済み記事を done ステップの提案モードUIに読み込む（生成直後と同じ画面が動く）
  const openSavedArticle = (item: any) => {
    const plan: any = {
      ...(item.plan && typeof item.plan === 'object' ? item.plan : {}),
      title: item.plan?.title || item.title || '',
      direction: item.plan?.direction || '',
      target: item.plan?.target || '',
      angle: item.plan?.angle || '',
      okExpressions: Array.isArray(item.plan?.okExpressions) ? item.plan.okExpressions : [],
      ngExpressions: Array.isArray(item.plan?.ngExpressions) ? item.plan.ngExpressions : [],
      expressions: Array.isArray(item.plan?.expressions) ? item.plan.expressions : [],
    }
    const content = {
      xPosts: Array.isArray(item.content?.xPosts) ? item.content.xPosts : [],
      noteTitle: item.content?.noteTitle || '',
      noteOutline: item.content?.noteOutline || '',
      noteBody: item.content?.noteBody || '',
    }
    setResults([{ plan, content, articleId: item.articleId }])
    setSelectedResult(0)
    setWritingMode('both')
    setWritingTab('note')
    setPreviewApproved(false)
    setShowSaved(false)
    setStep('done')
  }

  const copyDoc = async (idx: number, doc: string) => {
    try {
      await navigator.clipboard.writeText(doc)
      setCopiedDocIdx(idx)
      setTimeout(() => setCopiedDocIdx(c => c === idx ? null : c), 2000)
    } catch {}
  }

  // 構成をプレーンテキスト化（コピー用）
  const structurePlainText = (p: Plan) => {
    const lines: string[] = []
    lines.push(`${safeText(p.title)}`, '')
    lines.push('想定されるニーズ')
    const manifest = safeBullets(p.needsManifest), latent = safeBullets(p.needsLatent)
    if (manifest.length > 0) { lines.push('  【顕在ニーズ】'); manifest.forEach(s => lines.push(`  ・${s}`)) }
    if (latent.length > 0) { lines.push('  【潜在ニーズ】'); latent.forEach(s => lines.push(`  ・${s}`)) }
    if (manifest.length === 0 && latent.length === 0 && safeText(p.needs)) lines.push(`  ${safeText(p.needs)}`)
    lines.push('', 'ユーザーのゴール・得られる結果')
    if (safeText(p.userGoal)) lines.push(`  ${safeText(p.userGoal)}`)
    lines.push('', '必要な要素とストーリー')
    safeBullets(p.story).forEach(s => lines.push(`  ・${s}`))
    lines.push('', '記事目次')
    safeArr(p.outline).forEach((o: any) => {
      const heading = typeof o === 'string' ? o : safeText(o?.heading)
      if (heading) lines.push(`  ${heading}`)
      ;(typeof o === 'string' ? [] : safeArr(o?.subheadings)).forEach((sh: any) => lines.push(`    ${safeText(sh)}`))
    })
    return lines.join('\n')
  }

  const copyStructure = async (idx: number, p: Plan) => {
    try {
      await navigator.clipboard.writeText(structurePlainText(p))
      setCopiedStructIdx(idx)
      setTimeout(() => setCopiedStructIdx(c => c === idx ? null : c), 2000)
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
    return extractJsonObj(raw)
  }

  // JSONパースしない生テキスト版（インタビュー記事などmarkdown出力用）
  const callClaudeText = async (system: string, userMsg: string, maxTokens = 8000) => {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userMsg }] })
    })
    const data = await res.json()
    return data.content?.find((c: any) => c.type === 'text')?.text || ''
  }

  // VTT/txt の文字起こしファイルを text 欄に読み込む
  const onVtt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => setText(String(ev.target?.result || ''))
    reader.readAsText(f)
  }

  // インタビュー記事：4項目の設定からプロンプト分岐を組み立てる（STEP1/STEP2で共用）
  const buildInterviewBranches = () => {
    const formatBranch = interviewer.trim()
      ? `【出力形式：Q&A形式（担当者名あり）】\n質問者「${interviewer.trim()}」を各質問の冒頭に明記する。インタビュイーは「〇〇様（名前・所属）：」を毎回明記し、会話のキャッチボールが見える体裁にする。`
      : `【出力形式：ハイブリッド形式（担当者名なし）】\n質問は「## 見出し」として処理し、質問者の名義は出さない。インタビュイーは「**〇〇様（所属）**」で明記する。リード文にSAMURAI視点のナレーションを入れる。`
    const companyBranch = companyMode === 'with'
      ? `【会社名あり＝事例記事】\n会社名・担当者名・具体的な数字をすべてそのまま記載。会社概要ボックスを入れる。タイトルに会社名を含める。`
      : `【会社名なし＝コラム】\n会社名は「ある建設業の企業」「オフィス提案を手がける会社」等に置換。担当者名は「担当者」「デザイン責任者」等の役職表現に置換。会社概要ボックスは省略。学び・気づきを一般化して提示。タイトルは「〇〇を1/3に削減した方法」など汎用的な切り口に。`
    const mediumTone = medium === 'corp'
      ? 'コーポサイト：丁寧語・客観的・信頼感重視。「〜しています」「〜です」調。数字・固有名詞を積極的に使う。'
      : medium === 'kato_note'
      ? '加藤CEO note：加藤利基個人の視点・温度感。「〜だと感じました」「印象的だったのは〜」など一人称コメンタリーを挟む。読者との距離感が近い。'
      : '会社公式X：280字以内の要約ポスト。インパクトのある数字や一言を冒頭に、記事URLへの誘導で締める。'
    const skeleton = medium === 'company_x'
      ? `※媒体が会社公式Xのため、記事本文ではなく「280字以内の要約ポスト」を1本だけ生成すること（冒頭にインパクトのある数字/一言、末尾は記事URLへの誘導）。骨格①〜⑪は用いない。`
      : `【記事の骨格（この順序で固定）】\n① リード文（会社紹介＋導入効果の一言まとめ＋本記事の概要）\n② 会社概要ボックス（会社名・所在地・設立・資本金・従業員数・事業内容・URL）\n③ 導入前の課題・背景\n④ 課題の深掘り（なぜその課題が重要だったか）\n⑤ Renderyを選んだ理由\n⑥ 具体的な活用方法・業務フロー\n⑦ 導入後の効果（数字が得られていれば必ず定量値を入れる）\n⑧ 組織展開・定着の工夫（必須）\n   - 誰でも使えるようにするためにどんな仕組みを作ったか\n   - テンプレート化・マニュアル化・社内展開の工夫\n   - 文字起こしに情報がない場合は「今後の課題」として展望を記載\n⑨ 今後の展望\n⑩ 読者へのメッセージ\n⑪ まとめ段落（SAMURAI視点でこの事例の意義を締める）`
    return { formatBranch, companyBranch, mediumTone, skeleton }
  }

  // STEP1：骨子（タイトル案・切り口・各セクション見出し＋1行サマリー）を生成
  const runOutline = async () => {
    if (!text.trim()) { setError('文字起こし（テキスト or VTT）を入力してください'); return }
    setOutlineLoading(true); setError(''); setInterviewResult(null)
    try {
      const { companyBranch, mediumTone, skeleton } = buildInterviewBranches()
      const system = `あなたはSAMURAI ARCHITECTSの公開記事を執筆する編集者です。
インタビュー文字起こしから、記事の「骨子」だけを設計してください（本文はまだ書きません）。

${companyBranch}

【媒体・トーン】
${mediumTone}

${skeleton}

【出力】以下のJSONのみを返す（前後の説明文・コードブロック記号なし）：
{
  "titles": ["タイトル案を3つ"],
  "angle": "この記事の切り口・狙いを1〜2文で",
  "sections": [
    { "heading": "セクション見出し", "summary": "そのセクションで何を書くかを1行で" }
  ]
}
【ルール】
- sections は上記の骨格の順序・段構成に従う（会社公式Xの場合は要約ポストの構成案を1〜2項目で）。
- 文字起こしに無い事実・数字は創作しない。`
      const out = await callClaude(system, `以下の文字起こしから骨子を設計してください。\n\n${text.slice(0, 20000)}`)
      const outline = {
        titles: safeBullets(out?.titles),
        angle: safeText(out?.angle),
        sections: safeArr(out?.sections).map((s: any) => ({ heading: safeText(s?.heading), summary: safeText(s?.summary) })).filter((s: any) => s.heading || s.summary),
      }
      if (outline.sections.length === 0 && outline.titles.length === 0) { setError('骨子の生成に失敗しました'); }
      else { setInterviewOutline(outline); setInterviewStep('outline') }
    } catch (e) {
      console.error('[interview outline] error:', e)
      setError('骨子の生成に失敗しました：' + String(e))
    }
    setOutlineLoading(false)
  }

  // STEP2：STEP1の骨子をベースに本文を生成
  const runArticle = async () => {
    if (!text.trim()) { setError('文字起こしを入力してください'); return }
    setInterviewLoading(true); setError(''); setInterviewResult(null)
    try {
      const { formatBranch, companyBranch, mediumTone, skeleton } = buildInterviewBranches()
      const outlineBlock = interviewOutline
        ? `【STEP1で確定した骨子（これをベースに本文を書く）】\nタイトル案：${interviewOutline.titles.join(' / ') || '（なし）'}\n切り口：${interviewOutline.angle || '（なし）'}\nセクション構成：\n${interviewOutline.sections.map((s, i) => `${i + 1}. ${s.heading} — ${s.summary}`).join('\n')}\n\nタイトルは上記の案から最も適切なものを選ぶ（または微調整可）。本文は上記セクション構成に沿って執筆する。`
        : ''
      const system = `あなたはSAMURAI ARCHITECTSの公開記事を執筆する編集者です。
ユーザーインタビューの文字起こしから、SAMURAIの公開記事フォーマットに準拠した記事を生成してください。

${formatBranch}

${companyBranch}

【媒体・トーン】
${mediumTone}

${skeleton}

${outlineBlock}

【厳守ルール】
- 文字起こしに無い事実・数字を創作しないこと。会社概要ボックスは文字起こしに情報がある項目のみ記載し、不明な項目は省略する。
- 出力はmarkdownのみ。前後の説明文やコードブロック記号は付けない。

以下は公開済み記事のお手本（Few-shotサンプル）です。文体・構成・トーンを参考にすること（内容はコピーしない）：
=== FEW-SHOT サンプル ここから ===
${INTERVIEW_EXAMPLES}
=== FEW-SHOT サンプル ここまで ===`

      const out = await callClaudeText(system, `以下のインタビュー文字起こしから記事を生成してください。\n\n${text.slice(0, 20000)}`)
      if (out.trim()) setInterviewResult(out)
      else setError('記事生成に失敗しました')
    } catch (e) {
      console.error('[interview] error:', e)
      setError('記事生成に失敗しました：' + String(e))
    }
    setInterviewLoading(false)
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
personaBlock() +
`あなたはSAMURAI ARCHITECTSの企画担当AIです。上記「加藤ライター人格ブリーフ」の思想・文体・ガードレールに必ず従い、加藤利基本人が「自分の名前でぜひ発信したい」と思える企画だけを設計します。${pastNgForPlanning}

【最重要：加藤オーサーシップ（自分の名前で出したいか）】
発信の思想・文体・ガードレールはブリーフに従う（比喩は冒頭の"入口の一言"に留め、軸やタイトルにしない）。
各企画は、加藤本人が読んで「これは自分の名前でぜひ出したい」と思えるかを最優先に設計し、次の6点で自己採点する：
1. 一人称の原体験・動機が切り口か（家業=工務店、現場の課題感から起業、カタチ×施策）
2. 加藤固有の視点か（汎用ビジネス記事になっていないか）
3. 業界への敬意・両論を認める姿勢か（断罪していないか）
4. 比喩に逃げず本質（伴走／バックキャスト／建築家の役割再定義）に踏み込んでいるか
5. 嘘・最大値の誇張がなく、自分の言葉として成立するか
6. 「よく言ってくれた」と同業・読者が思う固有の踏み込みがあるか

【読者を動かす設計】
- 読者の「切実な問い」を背骨にする（誰のどの痛みか）。
- 読後に読者が「SAMURAI／加藤なら分かってくれる、相談したい・使ってみたい」と思う"信頼の作られ方"を必ず設計する（売り込み・CTAではなく、深い理解の証明で）。

【ターゲットペルソナと態度】
以下の3ペルソナ × 7態度のどのマスに向けた企画かを必ず明示すること。

ペルソナ：
・中小工務店経営者：中堅・30〜40代で事業承継/世代交代の渦中。深層心理＝取り残される怖さ×自分にもできるか半信半疑。デジタルに無縁ではなくnote/NewsPicks等に触れる。売り込みを嫌い、相談できる相手を求める
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

各企画について、記事の構成まで一気に設計してください：
・顕在ニーズ：読者が検索時に意識しているニーズ
・潜在ニーズ：読者が自覚していない本当の欲求
・記事目次は大見出し＋小見出しの2階層・10章以内
・企画の方向性（切り口・核心）と構成（ニーズ・ゴール・目次）が一貫するように生成すること

JSONのみ返してください：{"plans":[{"title":"企画タイトル","target":"想定読者","angle":"切り口・視点","point":"伝えたい核心","persona":"中小工務店経営者 | 設計事務所経営者 | 大手ディベロッパーDX担当者 のいずれか","stage":"日常 | 課題認知 | きっかけ | 自分事化 | 比較検討 | 商談・アポ | 導入・伴走 のいずれか","ceoAngle":"この企画で使う加藤CEO的な視点・比喩・語り口を1〜2文で","authorReason":"なぜ加藤がこれを語る必然があるか（使う実体験・原体験）を1〜2文で","readerQuestion":"読者の切実な問い（読者自身の言葉・一文で）","readerChange":"読後に読者がどう変わるか（1〜2文）","trustPath":"なぜ読者がSAMURAI／加藤に相談・利用したくなるか＝信頼の作られ方（1〜2文・売り込みでなく深い理解の証明で）","lead":"記事の書き出し案2〜3文（加藤の一人称・声で。読めば本人の声か判断できるもの）","authorScore":"0〜100の整数（上記6基準の総合＝加藤が自分の名前で出したい度）","authorNotes":"加藤が出したい理由 / 懸念を1〜2文で","needsManifest":"【顕在ニーズ】箇条書き（・で区切る）","needsLatent":"【潜在ニーズ】箇条書き（・で区切る）","userGoal":"読者が得られる結果（2〜3文）","story":"必要な要素とストーリー（箇条書き3〜5点）","outline":[{"heading":"大見出し","subheadings":["小見出し"]}]}]}`,
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
      setPlans((result.plans || []).map(normalizeStructuredPlan))
    } catch (e) {
      setError('企画生成に失敗しました。'); setStep('input')
    } finally {
      setLoading(false)
    }
  }

  // 構成プランをレンダリング安全な形に正規化（配列/オブジェクト混入を文字列・配列に矯正）
  const normalizeStructuredPlan = (p: any): Plan => ({
    ...(p && typeof p === 'object' && !Array.isArray(p) ? p : {}),
    title: safeText(p?.title),
    target: safeText(p?.target),
    angle: safeText(p?.angle),
    point: safeText(p?.point),
    needsManifest: safeText(p?.needsManifest),
    needsLatent: safeText(p?.needsLatent),
    userGoal: safeText(p?.userGoal),
    story: safeText(p?.story),
    authorReason: safeText(p?.authorReason),
    readerQuestion: safeText(p?.readerQuestion),
    readerChange: safeText(p?.readerChange),
    trustPath: safeText(p?.trustPath),
    lead: safeText(p?.lead),
    authorScore: typeof p?.authorScore === 'number' ? p.authorScore : (parseInt(String(p?.authorScore)) || 0),
    authorNotes: safeText(p?.authorNotes),
    outline: safeArr(p?.outline).map((o: any) =>
      typeof o === 'string'
        ? { heading: o, subheadings: [] as string[] }
        : { heading: safeText(o?.heading), subheadings: safeArr(o?.subheadings).map((s: any) => safeText(s)), description: safeText(o?.description) }
    ),
  })

  const runEditing = async () => {
    setError(''); setLoading(true); setStep('editing')
    try {
      // 過去のNG表現を取得
      const exRes = await fetch('/api/content-expressions')
      const exData = await exRes.json()
      const pastNg = exData.length > 0
        ? `\n\n【蓄積されたNG表現（必ず避けてください）】\n${[...new Set(exData.flatMap((e: any) => (e.items || []).filter((i: any) => i.judgment === 'NG').map((i: any) => i.expression || '')))].filter(Boolean).slice(0, 30).map((s: any) => `・${s}`).join('\n')}`
        : ''
      // 企画・構成エージェントで選択された企画（構成フィールド付き）を編集対象にする
      const selectedPlans = plans.filter((_, i) => selectedPlanIndices.has(i))
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
        // 企画の構成フィールドをタイトルで照合してマージ（編集出力には無いため保持）
        const src = selectedPlans.find(sp => sp.title === p.title) || {}
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
        articleId: newSuggestionId('art'),
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
    planning: '② 企画・構成エージェント',
    editing: '③ 編集エージェント',
    writing: '④ 執筆エージェント',
    done: '✓ 完了'
  }

  const r = results[selectedResult]
  const currentArticleId = r?.articleId

  // 表示中記事の提案を読み込む（記事ごとキー）
  useEffect(() => {
    if (!currentArticleId) { setSuggestions([]); return }
    let cancelled = false
    fetch(`/api/article-suggestions?articleId=${encodeURIComponent(currentArticleId)}`)
      .then(res => res.json())
      .then((d: any) => { if (!cancelled) setSuggestions(Array.isArray(d) ? d : []) })
      .catch(() => { if (!cancelled) setSuggestions([]) })
    return () => { cancelled = true }
  }, [currentArticleId])

  // 楽観更新 → サーバの merge-save 結果（supersede 反映済み）で確定
  const saveSuggestions = async (next: ArticleSuggestion[]) => {
    if (!currentArticleId) return
    setSuggestions(next)
    try {
      const res = await fetch('/api/article-suggestions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: currentArticleId, suggestions: next }),
      })
      const saved = await res.json()
      if (Array.isArray(saved)) setSuggestions(saved)
    } catch {}
  }

  const addSuggestion = (blockIndex: number, original: string, proposed: string) => {
    if (!reviewerName) { alert('先にレビュアー名を選んでください'); return }
    if (!proposed.trim() || proposed.trim() === original.trim()) { setSugDraftBlock(null); setSugDraftText(''); return }
    if (!currentArticleId) return
    const s: ArticleSuggestion = {
      id: newSuggestionId('sug'), articleId: currentArticleId, target: 'noteBody', blockIndex,
      original, proposed: proposed.trim(), status: 'pending', proposer: reviewerName, createdAt: new Date().toISOString(),
    }
    saveSuggestions([s, ...suggestions])
    setSugDraftBlock(null); setSugDraftText('')
  }

  const decideSuggestion = (s: ArticleSuggestion, status: 'approved' | 'rejected') => {
    if (!reviewerName) { alert('先にレビュアー名を選んでください'); return }
    const note = status === 'rejected' ? (window.prompt('却下の理由（任意）') || '') : ''
    saveSuggestions(suggestions.map(x => x.id === s.id
      ? { ...x, status, approver: reviewerName, note, decidedAt: new Date().toISOString() }
      : x))
  }

  // プレビュー／書き出しに流す内容（元 or 承認後）。原文(results)は決して上書きしない。
  const viewContent = r ? (previewApproved ? applyApproved(r.content, suggestions) : r.content) : null
  const approvedCount = suggestions.filter(s => s.status === 'approved').length

  // 承認後の内容を確定版として content-writings に別バージョン保存（任意・非破壊）
  const saveApprovedVersion = async () => {
    if (!r || !viewContent) return
    await fetch('/api/content-writings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: [{ plan: r.plan, content: viewContent, articleId: newSuggestionId('art'), derivedFrom: currentArticleId }],
        date: new Date().toLocaleDateString('ja-JP'), fileNames, version: 'approved',
      }),
    })
    alert('承認後の内容を確定版として保存しました')
  }

  // 文字単位 diff のレンダリング
  const renderDiff = (original: string, proposed: string) =>
    charDiff(original, proposed).map((seg, i) =>
      seg.type === 'equal' ? <span key={i}>{seg.value}</span>
      : seg.type === 'del' ? <del key={i} style={{ background: 'var(--rbg)', color: 'var(--red)' }}>{seg.value}</del>
      : <ins key={i} style={{ background: 'var(--gbg)', color: 'var(--green)', textDecoration: 'none' }}>{seg.value}</ins>
    )

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="pg-title">発信コンテンツ生成</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { const next = !showSaved; setShowSaved(next); setShowHistory(false); if (next) fetchSavedArticles() }} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: showSaved ? 'var(--ink)' : 'none', color: showSaved ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {showSaved ? '← 生成に戻る' : '📂 保存記事を提案モードで開く'}
          </button>
          <button onClick={() => { setShowHistory(!showHistory); setShowSaved(false); fetchHistory() }} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {showHistory ? '← 生成に戻る' : '📚 過去の企画履歴'}
          </button>
        </div>
      </div>
      <div className="pg-sub">企画・構成 → 編集 → 執筆の3エージェントがMTGから発信コンテンツを自動生成します</div>

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
          <button onClick={() => {
              const picked: Plan[] = selectedHistoryPlans.map(({ _key, ...p }) => normalizeStructuredPlan(p))
              setShowHistory(false)
              setPlans(picked)
              setSelectedPlanIndices(new Set(picked.map((_, i) => i)))
              setStep('planning')
            }}
            style={{ width: '100%', padding: 10, background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✍️ 選択した{selectedHistoryPlans.length}件を企画に渡す
          </button>
        </div>
      )}

      {/* 保存記事を提案モードで開く（phase1.5） */}
      {showSaved && (
        <div>
          <div className="pg-sub" style={{ marginBottom: 12 }}>保存済みの記事を1件選んで提案モードで開きます。生成し直さずに、別の人が後から提案・承認できます。</div>
          {savedLoading ? (
            <div style={{ padding: 20, color: 'var(--muted)', fontSize: 12 }}>読み込み中...</div>
          ) : savedArticles.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--muted)', fontSize: 12 }}>note本文のある保存記事がありません</div>
          ) : (
            savedArticles.map((item: any, i: number) => (
              <div key={item.articleId || i} onClick={() => openSavedArticle(item)}
                style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 14, marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{item.date}</span>
                  {item.version === 'approved' && <span style={{ fontSize: 10, color: 'var(--green)', background: 'var(--gbg)', borderRadius: 10, padding: '1px 8px' }}>確定版</span>}
                  {item.fileNames?.length > 0 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{item.fileNames.join(', ')}</span>}
                  <span style={{ fontSize: 10, color: 'var(--ink2)' }}>→ 提案モードで開く</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!showHistory && !showSaved && <>
      {/* 生成モード切り替え（既存モードと排他） */}
      {step === 'input' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([['content', '📰 発信コンテンツ生成'], ['interview', '🎤 ユーザーインタビュー記事']] as const).map(([val, label]) => (
            <button key={val} onClick={() => { setGenMode(val); setError(''); setInterviewResult(null) }}
              style={{ padding: '5px 14px', borderRadius: 20, border: '0.5px solid var(--b1)', background: genMode === val ? 'var(--ink)' : 'none', color: genMode === val ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600 }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ステップインジケーター（発信コンテンツモードのみ） */}
      {genMode === 'content' && (
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
      )}

      {/* STEP1: 入力（発信コンテンツモード） */}
      {step === 'input' && genMode === 'content' && (
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

      {/* ユーザーインタビュー記事モード（単発生成） */}
      {step === 'input' && genMode === 'interview' && (
        <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16 }}>
          {/* ステップインジケーター */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 11, fontWeight: 700 }}>
            <span style={{ color: interviewStep === 'setup' ? 'var(--ink)' : 'var(--muted)' }}>STEP1 骨子生成</span>
            <span style={{ color: 'var(--muted)' }}>→</span>
            <span style={{ color: interviewStep === 'outline' ? 'var(--ink)' : 'var(--muted)' }}>STEP2 本文生成</span>
          </div>

          {/* STEP1：設定入力 → 骨子生成 */}
          {interviewStep === 'setup' && (
            <>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>① 文字起こし（テキスト貼り付け or VTT/txtファイル）</label>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="インタビュー録音の文字起こしを貼り付け、またはファイルを読み込み" style={{ ...inp, minHeight: 160, resize: 'vertical' as const }} />
              <div style={{ marginTop: 6, marginBottom: 12 }}>
                <button onClick={() => vttRef.current?.click()} style={{ fontSize: 10, padding: '3px 10px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink2)' }}>📄 VTT/txtを読み込む</button>
                <input ref={vttRef} type="file" accept=".vtt,.txt" style={{ display: 'none' }} onChange={onVtt} />
              </div>

              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>② インタビュー担当者名（空欄可）</label>
              <input value={interviewer} onChange={e => setInterviewer(e.target.value)} placeholder="例：加藤（空欄ならハイブリッド形式で出力）" style={{ ...inp, marginBottom: 12 }} />

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>③ 媒体</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                  {([['corp', 'コーポサイト'], ['kato_note', '加藤CEO note'], ['company_x', '会社公式X']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setMedium(val)} style={{ padding: '4px 12px', borderRadius: 20, border: '0.5px solid var(--b1)', background: medium === val ? 'var(--ink)' : 'none', color: medium === val ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>{label}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>④ 会社名の出し方</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([['with', 'あり（事例記事）'], ['without', 'なし（コラム）']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setCompanyMode(val)} style={{ padding: '4px 12px', borderRadius: 20, border: '0.5px solid var(--b1)', background: companyMode === val ? 'var(--ink)' : 'none', color: companyMode === val ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>{label}</button>
                  ))}
                </div>
              </div>

              {error && <div style={{ color: 'var(--red)', fontSize: 12, margin: '8px 0' }}>{error}</div>}
              <button onClick={runOutline} disabled={outlineLoading} style={{ width: '100%', marginTop: 4, padding: 10, background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: outlineLoading ? 0.6 : 1 }}>
                {outlineLoading ? '🤖 骨子を生成中...' : '📝 骨子を生成する'}
              </button>
            </>
          )}

          {/* STEP2：骨子を確認 → 本文生成 */}
          {interviewStep === 'outline' && interviewOutline && (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 8 }}>STEP1 で生成した骨子</div>
                {interviewOutline.titles.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>タイトル案</div>
                    {interviewOutline.titles.map((t, i) => <div key={i} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>・{t}</div>)}
                  </div>
                )}
                {interviewOutline.angle && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>切り口</div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>{interviewOutline.angle}</div>
                  </div>
                )}
                {interviewOutline.sections.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>セクション構成（見出し＋サマリー）</div>
                    {interviewOutline.sections.map((s, i) => (
                      <div key={i} style={{ marginBottom: 6, paddingLeft: 8, borderLeft: '2px solid var(--b1)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{i + 1}. {s.heading}</div>
                        {s.summary && <div style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.6 }}>{s.summary}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <div style={{ color: 'var(--red)', fontSize: 12, margin: '8px 0' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setInterviewStep('setup'); setError('') }} disabled={interviewLoading} style={{ padding: '10px 16px', background: 'none', color: 'var(--ink2)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>← 設定に戻る</button>
                <button onClick={runArticle} disabled={interviewLoading} style={{ flex: 1, padding: 10, background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: interviewLoading ? 0.6 : 1 }}>
                  {interviewLoading ? '🤖 本文を生成中...' : '🎤 この骨子で本文を生成する'}
                </button>
              </div>

              {interviewResult && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>生成された記事</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={async () => { try { await navigator.clipboard.writeText(interviewResult); setInterviewCopied(true); setTimeout(() => setInterviewCopied(false), 2000) } catch {} }}
                        style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, border: '0.5px solid ' + (interviewCopied ? 'var(--green)' : 'var(--b1)'), background: interviewCopied ? 'var(--gbg)' : 'var(--paper)', color: interviewCopied ? 'var(--green)' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {interviewCopied ? '✓ コピーしました' : '📋 コピー'}
                      </button>
                      <button onClick={() => exportWord('インタビュー記事', [{ heading: '記事', body: interviewResult }])} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, border: '0.5px solid var(--b1)', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>📝 Word</button>
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: '20px 24px', fontSize: 13, lineHeight: 1.8 }}>
                    <ReactMarkdown components={{
                      h1: ({ children }) => <h1 style={{ fontSize: 18, fontWeight: 700, margin: '16px 0 10px' }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 700, margin: '16px 0 8px', borderBottom: '1px solid var(--b1)', paddingBottom: 4 }}>{children}</h2>,
                      h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 700, margin: '12px 0 6px' }}>{children}</h3>,
                      p: ({ children }) => <p style={{ margin: '0 0 12px', lineHeight: 1.9 }}>{children}</p>,
                      strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                      ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '4px 0 12px' }}>{children}</ul>,
                      li: ({ children }) => <li style={{ marginBottom: 6, lineHeight: 1.8 }}>{children}</li>,
                    }}>{interviewResult}</ReactMarkdown>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* STEP2: 企画結果 */}
      {step === 'planning' && !loading && plans.length > 0 && (
        <div>
          <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>企画エージェントの出力 — {plans.length}件</div>
            {plans.map((p, i) => {
              const manifest = safeBullets(p.needsManifest)
              const latent = safeBullets(p.needsLatent)
              const goal = safeText(p.userGoal)
              const storyBullets = safeBullets(p.story)
              const outline = safeArr(p.outline)
              const hasStruct = manifest.length > 0 || latent.length > 0 || !!goal || storyBullets.length > 0 || outline.length > 0
              return (
              <div key={i} onClick={() => setSelectedPlanIndices(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })}
                style={{ background: selectedPlanIndices.has(i) ? 'var(--gbg)' : 'var(--bg)', borderRadius: 'var(--r)', padding: 16, marginBottom: 10, cursor: 'pointer', border: selectedPlanIndices.has(i) ? '1px solid var(--green)' : '1px solid var(--b1)' }}>
                {/* タイトル＝判断の主役。大きく・濃く。 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: '1.5px solid var(--b1)', background: selectedPlanIndices.has(i) ? 'var(--green)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    {selectedPlanIndices.has(i) && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 3 }}>企画{i+1}</div>
                    <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.4 }}>{safeText(p.title)}</div>
                  </div>
                </div>
                {/* 伝えたい核心＝要約。全幅で大きく見せる。 */}
                {safeText(p.point) && (
                  <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>伝えたい核心</div>
                    <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.75 }}>{safeText(p.point)}</div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[['想定読者', p.target], ['切り口', p.angle]].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.6 }}>{val}</div>
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
                {(p.lead || p.authorReason || p.readerQuestion || p.trustPath || (p.authorScore ?? 0) > 0) && (
                  <div onClick={e => e.stopPropagation()} style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--b1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>🖋 加藤オーサーシップ</span>
                      {(p.authorScore ?? 0) > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: (p.authorScore ?? 0) >= 80 ? 'var(--green)' : (p.authorScore ?? 0) >= 60 ? '#d97706' : 'var(--red)' }}>{p.authorScore}<span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 500 }}> /100 出したい度</span></span>}
                    </div>
                    {p.lead && <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}><div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>書き出し案（加藤の声）</div><div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.7 }}>{p.lead}</div></div>}
                    {([['なぜ加藤が語るか', p.authorReason], ['読者の切実な問い', p.readerQuestion], ['読後の変化', p.readerChange], ['相談したくなる理由', p.trustPath], ['出したい理由/懸念', p.authorNotes]] as [string, string | undefined][]).filter(([, v]) => v).map(([label, val]) => (
                      <div key={label} style={{ marginBottom: 3 }}><span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)' }}>{label}：</span><span style={{ fontSize: 12, color: 'var(--ink2)' }}>{val}</span></div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      {([['publish', '✅ 出したい', 'var(--green)', 'var(--gbg)'], ['revise', '✏️ 直したい', '#d97706', '#fffbeb'], ['reject', '✖️ 却下', 'var(--red)', 'var(--rbg)']] as const).map(([v, label, col, bg]) => (
                        <button key={v} onClick={() => saveDecision(i, v, p)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 14, border: '0.5px solid ' + (verdicts[i] === v ? col : 'var(--b1)'), background: verdicts[i] === v ? bg : 'none', color: verdicts[i] === v ? col : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: verdicts[i] === v ? 700 : 500 }}>{label}</button>
                      ))}
                      {verdicts[i] && <span style={{ fontSize: 10, color: 'var(--green)' }}>✓ 記録しました</span>}
                    </div>
                  </div>
                )}
                {hasStruct && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--b1)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span onClick={() => toggleStruct(i)} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{expandedStruct.has(i) ? '▼' : '▶'} 構成（ニーズ・ゴール・目次）</span>
                      <button onClick={() => copyStructure(i, p)} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, border: '0.5px solid ' + (copiedStructIdx === i ? 'var(--green)' : 'var(--b1)'), background: copiedStructIdx === i ? 'var(--gbg)' : 'var(--paper)', color: copiedStructIdx === i ? 'var(--green)' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>{copiedStructIdx === i ? '✓ コピーしました' : '📋 コピー'}</button>
                    </div>
                    {expandedStruct.has(i) && (
                      <div style={{ marginTop: 6 }}>
                        {(manifest.length > 0 || latent.length > 0) && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>想定されるニーズ</div>}
                        {manifest.length > 0 && <div style={{ marginBottom: 4 }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)' }}>【顕在ニーズ】</div>{manifest.map((s, k) => <div key={k} style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6, paddingLeft: 8 }}>・{s}</div>)}</div>}
                        {latent.length > 0 && <div style={{ marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)' }}>【潜在ニーズ】</div>{latent.map((s, k) => <div key={k} style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6, paddingLeft: 8 }}>・{s}</div>)}</div>}
                        {goal && <><div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>ゴール・得られる結果</div><div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 6, lineHeight: 1.6 }}>{goal}</div></>}
                        {storyBullets.length > 0 && <><div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>要素とストーリー</div><div style={{ marginBottom: 6 }}>{storyBullets.map((s, k) => <div key={k} style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6, paddingLeft: 8 }}>・{s}</div>)}</div></>}
                        {outline.length > 0 && <div><div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>記事目次</div>{outline.map((o: any, j: number) => {
                          const heading = typeof o === 'string' ? o : safeText(o?.heading)
                          const subs = typeof o === 'string' ? [] : safeArr(o?.subheadings)
                          return (
                            <div key={j} style={{ marginBottom: 4 }}>
                              {heading && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{heading}</div>}
                              {subs.map((sh: any, k: number) => <div key={k} style={{ fontSize: 11, color: 'var(--ink2)', paddingLeft: 14, lineHeight: 1.6 }}>{safeText(sh)}</div>)}
                            </div>
                          )
                        })}</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
              )
            })}
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={async () => { await saveToHistory(plans, new Date().toLocaleDateString('ja-JP')); alert('企画を保存しました') }} style={{ padding: '6px 12px', border: '0.5px solid var(--green)', borderRadius: 'var(--r)', background: 'var(--gbg)', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600 }}>💾 企画を保存</button>
            <button onClick={() => exportPDF('企画案', planSections(plans))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📄 PDF出力</button>
            <button onClick={() => exportWord('企画案', planSections(plans))} style={{ padding: '6px 12px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📝 Word出力</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('input')} style={{ padding: '8px 16px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>← やり直す</button>
            <button onClick={runEditing} disabled={loading || selectedPlanIndices.size === 0} style={{ flex: 1, padding: 10, background: selectedPlanIndices.size > 0 ? 'var(--ink)' : 'var(--muted)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: selectedPlanIndices.size > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              ✍️ 選択した{selectedPlanIndices.size}件を編集
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
            <button onClick={() => setStep('planning')} style={{ padding: '8px 16px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>← 企画に戻る</button>
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
            {step === 'planning' ? '企画・構成エージェントが考えています...' : step === 'editing' ? '編集エージェントがチェックしています...' : '執筆エージェントが書いています...'}
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
            <button onClick={() => { setStep('input'); setResults([]); setShowSaved(true); fetchSavedArticles() }} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>📂 保存記事一覧へ</button>
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
                  <div>
                    {/* レビュアー選択（実名を localStorage に記憶。提案者≠承認者でも成立） */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>あなた（レビュアー）:</span>
                      {memberNames.map(n => (
                        <button key={n} onClick={() => pickReviewer(n)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 14, border: '0.5px solid ' + (reviewerName === n ? 'var(--ink)' : 'var(--b1)'), background: reviewerName === n ? 'var(--ink)' : 'none', color: reviewerName === n ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>{n}</button>
                      ))}
                      {!reviewerName && <span style={{ fontSize: 11, color: 'var(--red)' }}>← 選ぶと提案・承認できます</span>}
                    </div>

                    {/* プレビュー切替（元 / 承認後）＋ 表示中バージョンの書き出し */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setPreviewApproved(false)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 16, border: '0.5px solid ' + (!previewApproved ? 'var(--ink)' : 'var(--b1)'), background: !previewApproved ? 'var(--ink)' : 'none', color: !previewApproved ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>元（提案なし）</button>
                        <button onClick={() => setPreviewApproved(true)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 16, border: '0.5px solid ' + (previewApproved ? 'var(--green)' : 'var(--b1)'), background: previewApproved ? 'var(--gbg)' : 'none', color: previewApproved ? 'var(--green)' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: previewApproved ? 700 : 500 }}>承認後（{approvedCount}件適用）</button>
                      </div>
                      <div style={{ flex: 1 }} />
                      <button onClick={() => viewContent && exportPDF(viewContent.noteTitle || 'note', writingSections([{ plan: r.plan, content: viewContent }], 'note'))} style={{ fontSize: 11, padding: '4px 10px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>📄 この表示でPDF</button>
                      <button onClick={() => viewContent && exportWord(viewContent.noteTitle || 'note', writingSections([{ plan: r.plan, content: viewContent }], 'note'))} style={{ fontSize: 11, padding: '4px 10px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>📝 この表示でWord</button>
                      {previewApproved && approvedCount > 0 && (
                        <button onClick={saveApprovedVersion} style={{ fontSize: 11, padding: '4px 10px', border: '0.5px solid var(--green)', borderRadius: 'var(--r)', background: 'var(--gbg)', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>💾 確定版を保存</button>
                      )}
                    </div>

                    {/* プレビュー本文（元 or 承認後） */}
                    <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '24px 28px', position: 'relative' as const, marginBottom: 14, border: previewApproved ? '1px solid var(--green)' : '0.5px solid var(--b1)' }}>
                      <button onClick={() => viewContent && navigator.clipboard.writeText(`${viewContent.noteTitle}\n\n${viewContent.noteBody}`)} style={{ position: 'absolute' as const, top: 12, right: 12, fontSize: 10, padding: '2px 8px', border: '0.5px solid var(--b1)', borderRadius: 10, background: 'var(--paper)', cursor: 'pointer', fontFamily: 'inherit' }}>コピー</button>
                      <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.5, marginBottom: 20, paddingRight: 60 }}>{(viewContent || r.content).noteTitle}</h1>
                      <ReactMarkdown components={{
                        h1: ({children}) => <h1 style={{ fontSize: 18, fontWeight: 700, margin: '20px 0 10px', borderBottom: '1px solid var(--b1)', paddingBottom: 6 }}>{children}</h1>,
                        h2: ({children}) => <h2 style={{ fontSize: 15, fontWeight: 700, margin: '16px 0 8px' }}>{children}</h2>,
                        h3: ({children}) => <h3 style={{ fontSize: 13, fontWeight: 700, margin: '12px 0 6px' }}>{children}</h3>,
                        p: ({children}) => <p style={{ margin: '0 0 12px', lineHeight: 1.9, fontSize: 13 }}>{children}</p>,
                        strong: ({children}) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                        ul: ({children}) => <ul style={{ paddingLeft: 20, margin: '4px 0 12px' }}>{children}</ul>,
                        li: ({children}) => <li style={{ marginBottom: 6, lineHeight: 1.8, fontSize: 13 }}>{children}</li>,
                      }}>{(viewContent || r.content).noteBody}</ReactMarkdown>
                    </div>

                    {/* レビュー：ブロック単位の提案・承認/却下 */}
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 8 }}>✏️ レビュー（ブロックごとに提案）</div>
                    {splitBlocks(r.content.noteBody).map((block, bi) => {
                      const group = suggestions.filter(s => s.target === 'noteBody' && s.blockIndex === bi)
                      const hasApproved = group.some(s => s.status === 'approved')
                      return (
                        <div key={bi} style={{ border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 12, marginBottom: 8, background: 'var(--paper)' }}>
                          <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--ink)', whiteSpace: 'pre-wrap' as const }}>{block}</div>
                          {sugDraftBlock !== bi && (
                            <button onClick={() => { setSugDraftBlock(bi); setSugDraftText(block) }} style={{ marginTop: 8, fontSize: 10, padding: '3px 10px', border: '0.5px solid var(--b1)', borderRadius: 12, background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink2)' }}>✏️ このブロックを提案</button>
                          )}
                          {sugDraftBlock === bi && (
                            <div style={{ marginTop: 8 }}>
                              <textarea value={sugDraftText} onChange={e => setSugDraftText(e.target.value)} style={{ ...inp, minHeight: 80, lineHeight: 1.7, resize: 'vertical' as const, boxSizing: 'border-box' as const }} />
                              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                <button onClick={() => addSuggestion(bi, block, sugDraftText)} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--ink)', borderRadius: 14, background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>提案を送る</button>
                                <button onClick={() => { setSugDraftBlock(null); setSugDraftText('') }} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 14, background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink2)' }}>キャンセル</button>
                              </div>
                            </div>
                          )}
                          {group.map(s => {
                            const badge = s.status === 'approved' ? { t: '✅ 承認済み', c: 'var(--green)' }
                              : s.status === 'rejected' ? { t: '✗ 却下', c: 'var(--red)' }
                              : s.status === 'superseded' ? { t: '↩︎ 取り消し（他を承認）', c: 'var(--muted)' }
                              : { t: '⏳ 未判断', c: 'var(--ink2)' }
                            const conflict = s.status === 'pending' && hasApproved
                            return (
                              <div key={s.id} style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--b1)' }}>
                                <div style={{ fontSize: 12, lineHeight: 1.9, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }}>{renderDiff(s.original, s.proposed)}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginTop: 6 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: badge.c }}>{badge.t}</span>
                                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>提案: {s.proposer}{s.approver ? `／判断: ${s.approver}` : ''}</span>
                                  {conflict && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)' }}>競合（このブロックは承認済み）</span>}
                                  {s.note && <span style={{ fontSize: 10, color: 'var(--ink2)' }}>理由: {s.note}</span>}
                                  {s.status === 'pending' && (
                                    <>
                                      <button onClick={() => decideSuggestion(s, 'approved')} disabled={conflict} style={{ fontSize: 10, padding: '2px 10px', border: '0.5px solid var(--green)', borderRadius: 10, background: conflict ? 'none' : 'var(--gbg)', color: conflict ? 'var(--muted)' : 'var(--green)', cursor: conflict ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: conflict ? 0.5 : 1 }}>承認</button>
                                      <button onClick={() => decideSuggestion(s, 'rejected')} style={{ fontSize: 10, padding: '2px 10px', border: '0.5px solid var(--red)', borderRadius: 10, background: 'none', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }}>却下</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
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
