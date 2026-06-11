'use client'
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'

const CATEGORIES = ['競合動向', '業界トレンド', '顧客・市場', '技術・プロダクト', '自社への示唆']
const OUR_PRODUCTS = ['Rendery', 'knock knock 3D', 'knock knock AI', 'VISIOAL', 'カスタムソリューション']

const catColor: Record<string, string> = {
  '競合動向': '#dc2626', '業界トレンド': '#2563eb', '顧客・市場': '#7c3aed',
  '技術・プロダクト': '#0891b2', '自社への示唆': '#16a34a',
}
const prioColor: Record<string, string> = { high: '#dc2626', mid: '#d97706', low: '#64748b' }
const prioLabel: Record<string, string> = { high: '高', mid: '中', low: '低' }

interface Insight {
  id: string
  title: string
  category: string
  summary: string
  points: string[]
  relevance: string
  products: string[]
  soWhat: string
  actions: string[]
  sourceType: string
  sourceRef: string
  status: 'draft' | 'published'
  reactions: { helpful: number; learned: number }
  author: string
  createdAt: string
  publishedAt?: string
}

interface AgendaItem {
  id: string
  topic: string
  rationale: string
  category: string
  products: string[]
  priority: 'high' | 'mid' | 'low'
  status: 'proposed' | 'researching' | 'done'
  source: 'ai' | 'manual'
  createdAt: string
}

interface SourceItem {
  kind: 'トレンド' | '競合' | 'ナレッジ'
  title: string
  body: string
  ref: string
  meta: string
}

type FormState = Omit<Insight, 'id' | 'createdAt' | 'reactions'>
type Tab = 'feed' | 'sources' | 'agenda' | 'delivery' | 'skill'

// リサーチャーの初期ブリーフ（判断の土台）。手入力不要で機能するよう既定値を投入。
// 既知の事実（4プロダクト・建築/建設・正直訴求の哲学）のみを記し、未確定の詳細は明示的な追記欄にする。
const DEFAULT_BRIEF = `# SAMURAI ARCHITECTS リサーチャー・ブリーフ
（全AI生成の判断の土台。反応データから育てていく）

## 私たちは誰か
SAMURAI ARCHITECTS × THE MOLTS。建築・建設業界向けにプロダクトを展開。
- Rendery：建築CG/パース・レンダリング領域（用途・強み・想定ユーザーを追記）
- knock knock 3D：3D/ビジュアライゼーション領域（用途・強み・想定ユーザーを追記）
- knock knock AI：AI活用領域（用途・強み・想定ユーザーを追記）
- VISIOAL：（用途・強み・想定ユーザーを追記）
- カスタムソリューション：受託開発（用途・強み・想定ユーザーを追記）

## 誰に届けるか（社内の読み手）
自社の従業員。情報を読んで「学び・気づき・実行・貢献」につなげてもらうのがゴール。
分析の披露ではなく、明日の行動が変わることを最優先にする。

## 監視対象（情報源ポートフォリオ）
リサーチャーは次の5レーンを定点観測する：
1. 競合プレスリリース（PR TIMES等）：CG/建築パース/3Dビジュアライゼーション/施工・設計AIの新機能・新サービス。Rendery・knock knock 3D・knock knock AI の直接/価値競合 →「競合動向」
2. 業界専門誌・ニュース（JBpress・建設系メディア）：建設DX・人手不足・法改正・市場構造の変化 →「業界トレンド」「顧客・市場」
3. 技術・プロダクト動向：生成AI・3D/BIM・自動化の技術進化 →「技術・プロダクト」
4. 顧客・市場シグナル：工務店/設計事務所/不動産の業務課題・採用・倒産動向 →「顧客・市場」
5. 自社プロダクト関連キーワード：レンダリング/建築パース/内装デザインAI/受託開発DX
各情報は必ず「どの自社プロダクトの直接競合/価値競合か」「従業員が明日何をできるか」まで翻訳する。

## インサイト品質基準（必ず守る）
1. 具体性：抽象論で終わらせず、固有名・数字・事例で語る（ソースに無い数字は創作しない）
2. 自社関連性：必ず「どのプロダクト/施策にどう効くか」を明示する
3. アクション可能性：従業員が明日とれる具体行動に落とす（So What → Do What）
4. 正直さ：最大値の誇張を避け、中央値で誠実に伝える。不確実な点は「不確実」と明記する

## 訴求・表現の原則（THE MOLTS流）
- 最大公約数として正しい態度のみを並べ、過大表現で信頼を損なわない
- 競合の悪口ではなく、空白ポジション（誰も言っていない正しいこと）を突く`

const emptyForm = (): FormState => ({
  title: '', category: '競合動向', summary: '', points: [], relevance: '',
  products: [], soWhat: '', actions: [], sourceType: 'manual', sourceRef: '',
  status: 'published', author: '', publishedAt: '',
})

// AI応答からJSONを頑健に抽出（前後の説明やコードフェンス・末尾欠けに耐える）
const extractJson = (raw: string, arr = false): any => {
  const t = (raw || '').replace(/```json|```/g, '').trim()
  const open = arr ? '[' : '{', close = arr ? ']' : '}'
  const s = t.indexOf(open), e = t.lastIndexOf(close)
  if (s === -1 || e === -1 || e < s) throw new Error('AI応答からJSONを抽出できませんでした')
  return JSON.parse(t.slice(s, e + 1))
}

export default function Researcher() {
  const [tab, setTab] = useState<Tab>('feed')
  const [items, setItems] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // フィルター
  const [filterCat, setFilterCat] = useState<Set<string>>(new Set())
  const [filterProduct, setFilterProduct] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // AIアシスト
  const [aiSource, setAiSource] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [taskedAction, setTaskedAction] = useState<string>('')

  // ソース集約
  const [sources, setSources] = useState<SourceItem[]>([])
  const [srcLoading, setSrcLoading] = useState(false)
  const [srcKind, setSrcKind] = useState<'all' | 'トレンド' | '競合' | 'ナレッジ'>('all')
  const [urlInput, setUrlInput] = useState('')
  const [ingestLoading, setIngestLoading] = useState(false)
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoMsg, setAutoMsg] = useState('')

  // リサーチアジェンダ
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [agendaProposing, setAgendaProposing] = useState(false)

  // 配信＆ダイジェスト
  const [digest, setDigest] = useState('')
  const [digestLoading, setDigestLoading] = useState(false)
  const [digestCopied, setDigestCopied] = useState(false)

  // スキル：ブリーフ（判断の土台）と自己学習
  const [brief, setBrief] = useState('')          // 保存済み（AI注入に使用）
  const [briefDraft, setBriefDraft] = useState('') // 編集中バッファ
  const [briefUpdatedAt, setBriefUpdatedAt] = useState('')
  const [briefSaving, setBriefSaving] = useState(false)
  const [briefMsg, setBriefMsg] = useState('')
  const [learnLoading, setLearnLoading] = useState(false)
  const [learnSuggestion, setLearnSuggestion] = useState('')

  // 品質セルフレビュー（作成モーダル内）
  const [reviewLoading, setReviewLoading] = useState(false)
  const [review, setReview] = useState<{ score: number; strengths: string[]; improvements: string[] } | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/insights')
      const data = await res.json()
      if (Array.isArray(data)) setItems(data)
    } catch {}
    setLoading(false)
  }
  const loadAgenda = async () => {
    try {
      const res = await fetch('/api/research-agenda')
      const data = await res.json()
      if (Array.isArray(data)) setAgenda(data)
    } catch {}
  }
  const loadBrief = async () => {
    try {
      const res = await fetch('/api/researcher-brief')
      const data = await res.json()
      const b = (data?.brief || '').trim() ? data.brief : DEFAULT_BRIEF
      setBrief(b); setBriefDraft(b); setBriefUpdatedAt(data?.updatedAt || '')
    } catch { setBrief(DEFAULT_BRIEF); setBriefDraft(DEFAULT_BRIEF) }
  }
  useEffect(() => { load(); loadAgenda(); loadBrief() }, [])

  const toggleSet = (setter: (u: (s: Set<string>) => Set<string>) => void, val: string) =>
    setter(s => { const n = new Set(s); if (n.has(val)) n.delete(val); else n.add(val); return n })

  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))
  const toggleProduct = (p: string) => setForm(f => ({ ...f, products: f.products.includes(p) ? f.products.filter(x => x !== p) : [...f.products, p] }))

  // ブリーフを全AIプロンプトの先頭に注入（担当者の判断の土台を毎回参照させる）
  const briefBlock = () => (brief.trim() ? `# 参照：リサーチャー・ブリーフ（この方針・品質基準・訴求原則に必ず沿って出力する）\n${brief.trim()}\n\n---\n\n` : '')

  const openNew = () => { setEditId(null); setForm(emptyForm()); setReview(null); setAiSource(''); setError(''); setShowForm(true) }
  const openEdit = (it: Insight) => {
    setEditId(it.id)
    setForm({
      title: it.title, category: it.category, summary: it.summary, points: it.points || [],
      relevance: it.relevance, products: it.products || [], soWhat: it.soWhat, actions: it.actions || [],
      sourceType: it.sourceType, sourceRef: it.sourceRef, status: it.status, author: it.author, publishedAt: it.publishedAt || '',
    })
    setAiSource(''); setError(''); setReview(null); setShowForm(true)
  }

  // AIで骨子生成：貼り付けた情報源 + 自社プロダクト文脈から Claude が草案化
  const runAi = async (override?: string) => {
    const src = (override ?? aiSource).trim()
    if (!src) { setError('情報源テキスト（記事・ニュース・ナレッジ等）を貼り付けてください'); return }
    setAiLoading(true); setError(''); setReview(null)
    try {
      const system = briefBlock() + `あなたはSAMURAI ARCHITECTSのリサーチャーです。SAMURAIは建築・建設業界向けに次のプロダクトを展開しています：${OUR_PRODUCTS.join('、')}。
あなたのミッションは、外部情報を「分析」するだけでなく、従業員が読んで学び・気づき・実行できる『インサイト』に変換して届けることです。
与えられた情報源を読み、以下のJSONのみを返してください（前後の説明・コードブロック記号なし）：
{
  "title": "一目で要点が分かる見出し",
  "category": "${CATEGORIES.join('|')} のいずれか",
  "summary": "要点を2〜3文で",
  "points": ["キーポイントを3〜5個の箇条書きで"],
  "relevance": "この情報がSAMURAIの事業・プロダクトとどう関わるかを具体的に1〜2文で",
  "products": ["関連が深い自社プロダクト名（${OUR_PRODUCTS.join('|')} から該当するものを0〜複数）"],
  "soWhat": "従業員にとっての学び・気づき（So What）を1〜2文で",
  "actions": ["従業員が取れる具体的な推奨アクションを1〜3個"]
}
【ルール】情報源に無い事実・数字は創作しない。憶測が必要な場合はその旨を含めて控えめに書く。`
      const res = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2000, system, messages: [{ role: 'user', content: src.slice(0, 16000) }] }),
      })
      const data = await res.json()
      const raw = data.content?.find((c: any) => c.type === 'text')?.text || ''
      const p = extractJson(raw, false)
      setForm(f => ({
        ...f,
        title: p.title || f.title,
        category: CATEGORIES.includes(p.category) ? p.category : f.category,
        summary: p.summary || '',
        points: Array.isArray(p.points) ? p.points : [],
        relevance: p.relevance || '',
        products: Array.isArray(p.products) ? p.products.filter((x: string) => OUR_PRODUCTS.includes(x)) : [],
        soWhat: p.soWhat || '',
        actions: Array.isArray(p.actions) ? p.actions : [],
        sourceType: 'paste',
      }))
    } catch (e) {
      console.error('[researcher ai] error:', e)
      setError('AI生成に失敗しました：' + String(e))
    }
    setAiLoading(false)
  }

  const save = async () => {
    if (!form.title.trim() || !form.summary.trim()) { setError('タイトルと要点は必須です'); return }
    setSaving(true); setError('')
    try {
      if (editId) {
        // 下書き→公開に切替えた場合は公開日を記録（新規作成・公開トグルと挙動を揃える）
        const publishedAt = form.status === 'published' && !form.publishedAt ? new Date().toISOString().slice(0, 10) : form.publishedAt
        const patch = { id: editId, ...form, publishedAt }
        await fetch('/api/insights', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      } else {
        const entry: Insight = {
          id: 'ins_' + Date.now().toString() + Math.random().toString(36).slice(2, 7),
          ...form,
          reactions: { helpful: 0, learned: 0 },
          createdAt: new Date().toISOString(),
          publishedAt: form.status === 'published' ? new Date().toISOString().slice(0, 10) : '',
        }
        await fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      }
      setShowForm(false)
      await load()
    } catch (e) {
      setError('保存に失敗しました：' + String(e))
    }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!window.confirm('このインサイトを削除しますか？')) return
    await fetch('/api/insights', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  const react = async (it: Insight, kind: 'helpful' | 'learned') => {
    const reactions = { helpful: it.reactions?.helpful || 0, learned: it.reactions?.learned || 0 }
    reactions[kind] += 1
    setItems(list => list.map(x => x.id === it.id ? { ...x, reactions } : x)) // 楽観更新
    await fetch('/api/insights', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, reactions }) })
  }

  const togglePublish = async (it: Insight) => {
    const status = it.status === 'published' ? 'draft' : 'published'
    const publishedAt = status === 'published' && !it.publishedAt ? new Date().toISOString().slice(0, 10) : it.publishedAt
    setItems(list => list.map(x => x.id === it.id ? { ...x, status, publishedAt } : x))
    await fetch('/api/insights', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, status, publishedAt }) })
  }

  // 推奨アクションをタスク化（既存の /api/tasks へ追加）
  const toTask = async (it: Insight, action: string) => {
    try {
      const r = await fetch('/api/tasks')
      const tasks = await r.json()
      const list = Array.isArray(tasks) ? tasks : []
      const newTask = {
        id: 'task_' + Date.now().toString() + Math.random().toString(36).slice(2, 7),
        施策: 'リサーチ', name: action, s: '', e: '', own: 'both', st: 'todo', chg: false,
        assignee: '', src: 'researcher',
        背景: `リサーチ・インサイト「${it.title}」より。${it.soWhat || it.relevance}`,
        背景ソース: 'リサーチャー',
      }
      await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([...list, newTask]) })
      setTaskedAction(it.id + '::' + action)
      setTimeout(() => setTaskedAction(''), 2500)
    } catch (e) {
      setError('タスク化に失敗しました：' + String(e))
    }
  }

  // ===== ソース集約（自動インプット）=====
  const loadSources = async () => {
    setSrcLoading(true)
    const collected: SourceItem[] = []
    try {
      const [tRes, cRes, kRes] = await Promise.allSettled([
        fetch('/api/trends').then(r => r.json()),
        fetch('/api/competitors').then(r => r.json()),
        fetch('/api/knowledge').then(r => r.json()),
      ])
      if (tRes.status === 'fulfilled' && tRes.value?.results) {
        for (const g of tRes.value.results) {
          for (const n of (g.items || [])) {
            if (!n.title) continue
            collected.push({ kind: 'トレンド', title: n.title, body: `${n.title}（出典: ${n.source || 'Google News'} / キーワード: ${g.keyword}）`, ref: n.link || '', meta: n.source || g.keyword })
          }
        }
      }
      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value)) {
        for (const c of cRes.value.slice(0, 30)) {
          const name = c.competitorName || c.companyName || c.productName || '競合'
          const feats = Array.isArray(c.features) ? c.features.join('、') : ''
          const weaks = Array.isArray(c.weaknesses) ? c.weaknesses.join('、') : ''
          const addl = Array.isArray(c.additionalInfo) ? c.additionalInfo.map((a: any) => a?.summary).filter(Boolean).join(' / ') : ''
          const body = [
            c.summary && `概要: ${c.summary}`,
            c.target && `ターゲット: ${c.target}`,
            feats && `機能・特徴: ${feats}`,
            weaks && `弱み: ${weaks}`,
            c.pricing && `価格: ${c.pricing}`,
            c.threat && `脅威度: ${c.threat}`,
            addl && `追加情報: ${addl}`,
          ].filter(Boolean).join('\n')
          const ref = typeof c.source === 'string' && /^https?:/.test(c.source) ? c.source : ''
          collected.push({ kind: '競合', title: name, body: `競合「${name}」\n${body}`, ref, meta: c.relatedProduct || '競合DB' })
        }
      }
      if (kRes.status === 'fulfilled' && Array.isArray(kRes.value)) {
        for (const k of kRes.value.slice(0, 40)) {
          if (!k.title && !k.content) continue
          collected.push({ kind: 'ナレッジ', title: k.title || (k.content || '').slice(0, 30), body: `${k.title || ''}\n${k.content || ''}`, ref: k.source || '', meta: k.label || 'ナレッジ' })
        }
      }
    } catch {}
    setSources(collected)
    setSrcLoading(false)
  }
  useEffect(() => { if (tab === 'sources' && sources.length === 0 && !srcLoading) loadSources() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // 自走：自動収集バッチを今すぐ実行（毎日のVercel Cronと同じ /api/cron/research を叩く）
  const runAutoCollect = async () => {
    setAutoRunning(true); setAutoMsg(''); setError('')
    try {
      const r = await fetch('/api/cron/research')
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      if (d.created > 0) {
        setAutoMsg(`✓ ${d.created}件の下書きを自動生成しました（📋インサイトの「下書き」に追加）`)
        await load()
        setTab('feed'); setFilterStatus('draft'); setError('')
      } else {
        setAutoMsg(d.message || '新規の収集対象はありませんでした')
      }
    } catch (e) {
      setError('自動収集に失敗：' + String(e))
    }
    setAutoRunning(false)
  }

  // 任意URL（競合プレスリリース・専門誌記事など）を取り込み → 本文を抽出してAI草案化
  const ingestUrl = async () => {
    const u = urlInput.trim()
    if (!u) { setError('記事・プレスリリースのURLを入力してください'); return }
    if (!/^https?:\/\//.test(u)) { setError('http(s):// から始まるURLを入力してください'); return }
    setIngestLoading(true); setError('')
    try {
      const r = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: u }) })
      const d = await r.json()
      const text = (d.text || '').trim()
      if (!text) throw new Error(d.error || '本文を取得できませんでした（PDFや認証が必要なページは取得できません）')
      setUrlInput('')
      await draftFromSource({ kind: 'トレンド', title: text.slice(0, 44), body: `出典URL: ${u}\n\n${text}`, ref: u, meta: 'URL取り込み' })
    } catch (e) {
      setError('URL取り込みに失敗：' + String(e))
    }
    setIngestLoading(false)
  }

  // ソース1件をAI草案化 → 下書きインサイトのフォームを開く
  const draftFromSource = async (s: SourceItem) => {
    setEditId(null)
    setForm({ ...emptyForm(), status: 'draft', sourceRef: s.ref, sourceType: s.kind })
    setAiSource(s.body); setError(''); setReview(null); setShowForm(true)
    await runAi(s.body)
  }

  // ===== リサーチアジェンダ（自走の頭脳）=====
  const coverage = () => {
    const pub = items.filter(i => i.status === 'published')
    const byProduct: Record<string, number> = {}
    OUR_PRODUCTS.forEach(p => byProduct[p] = pub.filter(i => (i.products || []).includes(p)).length)
    const byCat: Record<string, number> = {}
    CATEGORIES.forEach(c => byCat[c] = pub.filter(i => i.category === c).length)
    const engByCat: Record<string, number> = {}
    CATEGORIES.forEach(c => engByCat[c] = pub.filter(i => i.category === c).reduce((s, i) => s + (i.reactions?.helpful || 0) + (i.reactions?.learned || 0), 0))
    return { byProduct, byCat, engByCat, total: pub.length }
  }

  const proposeAgenda = async () => {
    setAgendaProposing(true); setError('')
    try {
      const cov = coverage()
      const recentTrends = sources.filter(s => s.kind === 'トレンド').slice(0, 12).map(s => '・' + s.title).join('\n')
        || items.filter(i => i.category === '業界トレンド').slice(0, 8).map(i => '・' + i.title).join('\n')
      const existingTopics = agenda.filter(a => a.status !== 'done').map(a => '・' + a.topic).join('\n')
      const system = briefBlock() + `あなたはSAMURAI ARCHITECTSのリサーチ責任者です。プロダクト：${OUR_PRODUCTS.join('、')}。
リサーチャーが「次に何を調べるべきか」を、配信実績・反応・網羅の穴から自律的に決めるのを支援します。
配信が手薄なプロダクト・カテゴリ、反応が弱い領域、未消化のトレンドを埋める研究テーマを優先度付きで提案してください。
以下のJSON配列のみを返す（説明・コードブロック記号なし）。3〜6件：
[{"topic":"具体的な調査テーマ（問いの形が望ましい）","rationale":"なぜ今これを調べるべきか（網羅の穴/反応/トレンド根拠）を1文","category":"${CATEGORIES.join('|')} のいずれか","products":["関連プロダクト 0〜複数（${OUR_PRODUCTS.join('|')}）"],"priority":"high|mid|low"}]
【ルール】既出テーマの重複を避ける。事実は創作しない。網羅の薄い箇所を優先。`
      const context = `# 配信済みインサイト：${cov.total}件
## プロダクト別 配信数（少ない＝穴）
${OUR_PRODUCTS.map(p => `・${p}: ${cov.byProduct[p]}件`).join('\n')}
## カテゴリ別 配信数 / 反応合計（反応低い＝刺さっていない or 未開拓）
${CATEGORIES.map(c => `・${c}: ${cov.byCat[c]}件 / 反応${cov.engByCat[c]}`).join('\n')}
## 最近のトレンド・未消化情報
${recentTrends || '（なし）'}
## 既にアジェンダにあるテーマ（重複回避）
${existingTopics || '（なし）'}`
      const res = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1600, system, messages: [{ role: 'user', content: context }] }),
      })
      const data = await res.json()
      const raw = data.content?.find((c: any) => c.type === 'text')?.text || ''
      const arr = extractJson(raw, true)
      if (!Array.isArray(arr)) throw new Error('AI応答が配列ではありません')
      const now = new Date().toISOString()
      const newItems: AgendaItem[] = arr.slice(0, 6).map((p: any, i: number): AgendaItem => ({
        id: 'agd_' + Date.now().toString() + i + Math.random().toString(36).slice(2, 5),
        topic: String(p.topic || '').slice(0, 200),
        rationale: String(p.rationale || ''),
        category: CATEGORIES.includes(p.category) ? p.category : '自社への示唆',
        products: Array.isArray(p.products) ? p.products.filter((x: string) => OUR_PRODUCTS.includes(x)) : [],
        priority: ['high', 'mid', 'low'].includes(p.priority) ? p.priority : 'mid',
        status: 'proposed', source: 'ai', createdAt: now,
      })).filter((a: AgendaItem) => a.topic)
      await fetch('/api/research-agenda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newItems) })
      await loadAgenda()
    } catch (e) {
      console.error('[agenda ai] error:', e)
      setError('テーマ提案に失敗しました：' + String(e))
    }
    setAgendaProposing(false)
  }

  const addManualAgenda = async () => {
    const topic = window.prompt('調査テーマを入力してください')
    if (!topic?.trim()) return
    const entry: AgendaItem = {
      id: 'agd_' + Date.now().toString() + Math.random().toString(36).slice(2, 5),
      topic: topic.trim(), rationale: '', category: '自社への示唆', products: [],
      priority: 'mid', status: 'proposed', source: 'manual', createdAt: new Date().toISOString(),
    }
    await fetch('/api/research-agenda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
    await loadAgenda()
  }

  const patchAgenda = async (id: string, patch: Partial<AgendaItem>) => {
    setAgenda(list => list.map(a => a.id === id ? { ...a, ...patch } : a))
    await fetch('/api/research-agenda', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
  }
  const removeAgenda = async (id: string) => {
    setAgenda(list => list.filter(a => a.id !== id))
    await fetch('/api/research-agenda', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }
  // アジェンダ → 草案フォームを開く（テーマを文脈として渡す）
  const draftFromAgenda = (a: AgendaItem) => {
    setEditId(null)
    setForm({ ...emptyForm(), status: 'draft', title: a.topic, category: a.category, products: a.products, summary: a.rationale })
    setAiSource(''); setError(''); setReview(null); setShowForm(true)
    patchAgenda(a.id, { status: 'researching' })
  }

  // ===== 従業員向け週次ダイジェスト =====
  const generateDigest = async () => {
    setDigestLoading(true); setError('')
    try {
      const pub = items.filter(i => i.status === 'published')
      const score = (i: Insight) => (i.reactions?.helpful || 0) + (i.reactions?.learned || 0)
      const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
      const recent = pub.filter(i => (i.publishedAt || (i.createdAt || '').slice(0, 10)) >= since)
      const pool = recent.length >= 3 ? recent : pub // 直近が乏しければ全公開から反応上位で補う
      const top = [...pool].sort((a, b) => score(b) - score(a)).slice(0, 6)
      if (top.length === 0) { setDigest(''); setError('公開済みインサイトがありません'); setDigestLoading(false); return }
      const body = top.map((i, n) => `${n + 1}. [${i.category}] ${i.title}\n要点: ${i.summary}\n示唆: ${i.soWhat}\n推奨アクション: ${(i.actions || []).join(' / ')}`).join('\n\n')
      const system = briefBlock() + `あなたはSAMURAI ARCHITECTSのリサーチャーです。以下は最近配信した注目インサイトです。従業員が朝のSlackでさっと読んで学び・行動につなげられる『リサーチダイジェスト』にまとめてください。
Markdown形式。冒頭に1〜2文の前書き、各トピックは「見出し→一言要約→だから何をすべきか」の順。最後に「次の問いかけ」を1つ。親しみやすく簡潔に。情報源に無い事実・数字・日付は足さない。`
      const res = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2000, system, messages: [{ role: 'user', content: body }] }),
      })
      const data = await res.json()
      const raw = data.content?.find((c: any) => c.type === 'text')?.text || ''
      setDigest(raw.trim())
    } catch (e) {
      setError('ダイジェスト生成に失敗しました：' + String(e))
    }
    setDigestLoading(false)
  }
  const copyDigest = async () => {
    try { await navigator.clipboard.writeText(digest); setDigestCopied(true); setTimeout(() => setDigestCopied(false), 2000) } catch {}
  }

  // ===== スキル：ブリーフ保存・自己学習・セルフレビュー =====
  const saveBrief = async () => {
    setBriefSaving(true); setBriefMsg('')
    try {
      const res = await fetch('/api/researcher-brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief: briefDraft }) })
      const data = await res.json()
      setBrief(briefDraft); setBriefUpdatedAt(data?.updatedAt || new Date().toISOString())
      setBriefMsg('✓ 保存しました（以後のAI生成に反映されます）')
      setTimeout(() => setBriefMsg(''), 3000)
    } catch (e) { setBriefMsg('保存に失敗しました：' + String(e)) }
    setBriefSaving(false)
  }

  // 反応データから「効いている型／伸びしろ」をAIが読み、ブリーフ更新案を起案
  const extractLearnings = async () => {
    setLearnLoading(true); setError(''); setLearnSuggestion('')
    try {
      const c = coverage()
      const pub = items.filter(i => i.status === 'published')
      const score = (i: Insight) => (i.reactions?.helpful || 0) + (i.reactions?.learned || 0)
      const ranked = [...pub].sort((a, b) => score(b) - score(a))
      const tops = ranked.slice(0, 5).map(i => `・[${i.category}/反応${score(i)}] ${i.title}`).join('\n')
      const lows = ranked.slice(-5).reverse().map(i => `・[${i.category}/反応${score(i)}] ${i.title}`).join('\n')
      const system = `あなたはSAMURAI ARCHITECTSのリサーチ責任者です。リサーチャー担当者の「ブリーフ（判断の土台）」を、従業員の反応データから改善します。
反応が高い型・低い型を読み、次回以降の出力を良くするための具体的な指針を、ブリーフに追記する形（Markdownの箇条書き3〜6項目）で提案してください。
抽象論を避け「どのカテゴリ/型を厚くし、何をやめるか」を断定的に。前置き・締めの文は不要、箇条書きのみ。事実は創作しない。`
      const context = `## カテゴリ別 配信数 / 反応合計
${CATEGORIES.map(cat => `・${cat}: ${c.byCat[cat]}件 / 反応${c.engByCat[cat]}`).join('\n')}
## プロダクト別 配信数
${OUR_PRODUCTS.map(p => `・${p}: ${c.byProduct[p]}件`).join('\n')}
## 反応が高いインサイト
${tops || '（データなし）'}
## 反応が低い/ゼロのインサイト
${lows || '（データなし）'}`
      const res = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1200, system, messages: [{ role: 'user', content: context }] }),
      })
      const data = await res.json()
      const raw = data.content?.find((c2: any) => c2.type === 'text')?.text || ''
      if (!raw.trim()) throw new Error('空の応答')
      setLearnSuggestion(raw.trim())
    } catch (e) {
      setError('学びの抽出に失敗しました：' + String(e))
    }
    setLearnLoading(false)
  }

  const appendLearningsToBrief = () => {
    if (!learnSuggestion.trim()) return
    const stamp = new Date().toISOString().slice(0, 10)
    setBriefDraft(d => `${d}\n\n## 反応からの学び（${stamp}）\n${learnSuggestion.trim()}`)
    setLearnSuggestion('')
    setBriefMsg('草案に追記しました。内容を確認して「保存」を押してください。')
    setTimeout(() => setBriefMsg(''), 4000)
  }

  // 草案を品質基準で自己採点し、改善点を提示（公開前の質担保）
  const runSelfReview = async () => {
    if (!form.title.trim() && !form.summary.trim()) { setError('レビュー対象がありません。先に草案を作成してください'); return }
    setReviewLoading(true); setError(''); setReview(null)
    try {
      const system = briefBlock() + `あなたはSAMURAI ARCHITECTSのリサーチ品質レビュアーです。以下のインサイト草案を、ブリーフの品質基準（①具体性 ②自社関連性 ③アクション可能性 ④正直さ＝誇張していないか）で評価してください。
以下のJSONのみ返す（説明・コードブロック記号なし）：
{"score": 0〜100の整数(全体品質), "strengths": ["良い点を1〜3個"], "improvements": ["具体的な改善指示を2〜4個。どの項目をどう直すかを断定的に"]}
【ルール】誇張・断定しすぎ・自社関連やアクションの欠落は厳しく減点する。`
      const draft = `タイトル: ${form.title}\nカテゴリ: ${form.category}\n要点: ${form.summary}\nキーポイント: ${form.points.join(' / ')}\n自社事業との関わり: ${form.relevance}\n従業員への示唆: ${form.soWhat}\n推奨アクション: ${form.actions.join(' / ')}`
      const res = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 900, system, messages: [{ role: 'user', content: draft }] }),
      })
      const data = await res.json()
      const raw = data.content?.find((c: any) => c.type === 'text')?.text || ''
      const r = extractJson(raw, false)
      setReview({ score: Number(r.score) || 0, strengths: Array.isArray(r.strengths) ? r.strengths : [], improvements: Array.isArray(r.improvements) ? r.improvements : [] })
    } catch (e) {
      setError('セルフレビューに失敗しました：' + String(e))
    }
    setReviewLoading(false)
  }

  // ===== 統計 =====
  const published = items.filter(i => i.status === 'published')
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const newThisWeek = items.filter(i => i.createdAt >= weekAgo).length
  const totalHelpful = items.reduce((s, i) => s + (i.reactions?.helpful || 0), 0)
  const totalLearned = items.reduce((s, i) => s + (i.reactions?.learned || 0), 0)
  const openAgenda = agenda.filter(a => a.status !== 'done').length
  const cov = coverage()

  // フィルター適用
  const filtered = items
    .filter(i => filterStatus === 'all' || i.status === filterStatus)
    .filter(i => filterCat.size === 0 || filterCat.has(i.category))
    .filter(i => filterProduct.size === 0 || (i.products || []).some(p => filterProduct.has(p)))
    .filter(i => { if (!search.trim()) return true; const q = search.toLowerCase(); return (i.title + i.summary + i.relevance + i.soWhat + (i.points || []).join(' ') + (i.actions || []).join(' ')).toLowerCase().includes(q) })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  const TABS: [Tab, string][] = [['feed', '📋 インサイト'], ['sources', '🔌 ソース＆草案'], ['agenda', '🎯 リサーチアジェンダ'], ['delivery', '📊 配信＆学習'], ['skill', '🧠 スキル&ブリーフ']]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="pg-title">🔭 リサーチャー</div>
        {tab === 'feed' && <button onClick={openNew} style={btnPrimary}>+ インサイトを作成</button>}
        {tab === 'agenda' && <div style={{ display: 'flex', gap: 8 }}><button onClick={addManualAgenda} style={btnGhost}>+ テーマ追加</button><button onClick={proposeAgenda} disabled={agendaProposing} style={{ ...btnPrimary, opacity: agendaProposing ? 0.6 : 1 }}>{agendaProposing ? '🧠 提案中...' : '🧠 次のテーマをAI提案'}</button></div>}
        {tab === 'sources' && <button onClick={loadSources} disabled={srcLoading} style={{ ...btnPrimary, opacity: srcLoading ? 0.6 : 1 }}>{srcLoading ? '取得中...' : '🔄 ソースを再取得'}</button>}
        {tab === 'delivery' && <button onClick={generateDigest} disabled={digestLoading} style={{ ...btnPrimary, opacity: digestLoading ? 0.6 : 1 }}>{digestLoading ? '📰 生成中...' : '📰 ダイジェストを生成'}</button>}
        {tab === 'skill' && <button onClick={saveBrief} disabled={briefSaving || briefDraft === brief} style={{ ...btnPrimary, opacity: (briefSaving || briefDraft === brief) ? 0.5 : 1 }}>{briefSaving ? '保存中...' : '💾 ブリーフを保存'}</button>}
      </div>
      <div className="pg-sub">外部情報を「自社事業との関わり」と「従業員への示唆」に変換して届ける。収集→配信→反応→次の研究テーマが回り続ける自走ループ。</div>

      {/* 統計 */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 14 }}>
        {([['公開インサイト', published.length, 'var(--ink)'], ['今週の新着', newThisWeek, '#2563eb'], ['👍 役立った 累計', totalHelpful, '#16a34a'], ['💡 学びになった 累計', totalLearned, '#7c3aed'], ['🎯 未完了テーマ', openAgenda, '#d97706']] as [string, number, string][]).map(([label, count, color]) => (
          <div key={label} className="sc">
            <div className="sc-ey">{label}</div>
            <div className="sc-v" style={{ color }}>{count}</div>
          </div>
        ))}
      </div>

      {/* サブタブ */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid var(--b1)', marginBottom: 14 }}>
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => { setTab(v); setError('') }} style={{ padding: '7px 14px', border: 'none', borderBottom: '2px solid ' + (tab === v ? 'var(--ink)' : 'transparent'), background: 'none', color: tab === v ? 'var(--ink)' : 'var(--muted)', fontSize: 12, fontWeight: tab === v ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}>{l}</button>
        ))}
      </div>

      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

      {/* ===== タブ: インサイト ===== */}
      {tab === 'feed' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={flabel}>カテゴリ</span>
              {CATEGORIES.map(c => <button key={c} onClick={() => toggleSet(setFilterCat, c)} style={chip(filterCat.has(c))}>{c}</button>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={flabel}>プロダクト</span>
              {OUR_PRODUCTS.map(p => <button key={p} onClick={() => toggleSet(setFilterProduct, p)} style={chip(filterProduct.has(p))}>{p}</button>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={flabel}>状態</span>
              {([['all', 'すべて'], ['published', '公開'], ['draft', '下書き']] as [typeof filterStatus, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setFilterStatus(v)} style={chip(filterStatus === v)}>{l}</button>
              ))}
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="検索..." style={{ ...inp, width: 180, marginLeft: 'auto' }} />
            </div>
          </div>

          {loading && <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>読み込み中...</div>}
          {!loading && filtered.length === 0 && <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>インサイトがありません。「+ インサイトを作成」または「🔌 ソース＆草案」から登録してください。</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
            {filtered.map(it => {
              const open = expandedId === it.id
              return (
                <div key={it.id} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8, opacity: it.status === 'draft' ? 0.7 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: catColor[it.category] || '#666', padding: '1px 7px', borderRadius: 10 }}>{it.category}</span>
                    {(it.products || []).map(p => <span key={p} style={{ fontSize: 9, background: 'var(--bg)', border: '0.5px solid var(--b1)', color: 'var(--ink2)', padding: '1px 6px', borderRadius: 10 }}>{p}</span>)}
                    {it.status === 'draft' && <span style={{ fontSize: 9, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>下書き</span>}
                    <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 'auto' }}>{it.publishedAt || (it.createdAt || '').slice(0, 10)}</span>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4 }}>{it.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>{it.summary}</div>

                  {open && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '0.5px solid var(--b1)', paddingTop: 8 }}>
                      {(it.points || []).length > 0 && (
                        <div><div style={detailLabel}>キーポイント</div>{(it.points || []).map((p, i) => <div key={i} style={bullet}>・{p}</div>)}</div>
                      )}
                      {it.relevance && <div><div style={detailLabel}>自社事業との関わり</div><div style={detailText}>{it.relevance}</div></div>}
                      {it.soWhat && <div style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 6, padding: '8px 10px' }}><div style={{ ...detailLabel, color: '#16a34a' }}>💡 従業員への示唆（So What）</div><div style={detailText}>{it.soWhat}</div></div>}
                      {(it.actions || []).length > 0 && (
                        <div><div style={detailLabel}>推奨アクション</div>
                          {(it.actions || []).map((a, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <div style={{ ...bullet, flex: 1 }}>・{a}</div>
                              <button onClick={() => toTask(it, a)} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, border: '0.5px solid var(--b1)', background: taskedAction === it.id + '::' + a ? 'var(--gbg)' : 'var(--bg)', color: taskedAction === it.id + '::' + a ? 'var(--green)' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>{taskedAction === it.id + '::' + a ? '✓ タスク化' : '→ タスク化'}</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {it.sourceRef && <div style={{ fontSize: 10, color: 'var(--muted)' }}>ソース：{/^https?:/.test(it.sourceRef) ? <a href={it.sourceRef} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>{it.sourceRef}</a> : it.sourceRef}</div>}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <button onClick={() => react(it, 'helpful')} style={reactBtn}>👍 役立った <b>{it.reactions?.helpful || 0}</b></button>
                    <button onClick={() => react(it, 'learned')} style={reactBtn}>💡 学びになった <b>{it.reactions?.learned || 0}</b></button>
                    <button onClick={() => setExpandedId(open ? null : it.id)} style={{ ...miniBtn, marginLeft: 'auto' }}>{open ? '閉じる' : '詳細'}</button>
                    <button onClick={() => togglePublish(it)} style={miniBtn} title="公開/下書き切替">{it.status === 'published' ? '下書きに' : '公開する'}</button>
                    <button onClick={() => openEdit(it)} style={miniBtn}>編集</button>
                    <button onClick={() => remove(it.id)} style={{ ...miniBtn, color: 'var(--muted)' }}>🗑</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ===== タブ: ソース＆草案 ===== */}
      {tab === 'sources' && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>トレンド・競合・ナレッジに溜まった情報を横断表示。「→ AI草案化」で下書きインサイトに変換し、配信物として消化する。</div>

          {/* 自走モード：人手なしで自動収集→草案化（毎日定期実行＋手動トリガー） */}
          <div style={{ background: 'var(--ink)', borderRadius: 'var(--r)', padding: 14, marginBottom: 14, color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>🤖 自走モード（自動収集）</div>
              <span style={{ fontSize: 10, opacity: 0.8, marginLeft: 'auto' }}>毎朝7時に自動実行</span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, margin: '6px 0 10px', lineHeight: 1.6 }}>担当者が何もしなくても、毎日 業界・競合ニュースを収集→AIがインサイト下書きを自動生成します。公開はあなたがレビューして判断（品質ゲート）。今すぐ走らせることもできます。</div>
            <button onClick={runAutoCollect} disabled={autoRunning} style={{ padding: '6px 16px', background: '#fff', color: 'var(--ink)', border: 'none', borderRadius: 'var(--r)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: autoRunning ? 0.6 : 1 }}>{autoRunning ? '🤖 収集中...（最大1分）' : '▶ 今すぐ自動収集を実行'}</button>
            {autoMsg && <span style={{ fontSize: 11, marginLeft: 10 }}>{autoMsg}</span>}
          </div>

          {/* 任意URL取り込み：競合プレスリリース・専門誌記事を直接インサイト化 */}
          <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>🔗 URLから取り込む</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8 }}>競合のプレスリリース（PR TIMES等）や専門誌記事のURLを貼ると、本文を抽出してAIが草案化します。</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !ingestLoading) ingestUrl() }} placeholder="https://prtimes.jp/... や https://jbpress.ismedia.jp/... など" style={{ ...inp, flex: 1 }} />
              <button onClick={ingestUrl} disabled={ingestLoading} style={{ ...btnPrimary, whiteSpace: 'nowrap', opacity: ingestLoading ? 0.6 : 1 }}>{ingestLoading ? '取り込み中...' : '→ 取り込んで草案化'}</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {(['all', 'トレンド', '競合', 'ナレッジ'] as const).map(k => <button key={k} onClick={() => setSrcKind(k)} style={chip(srcKind === k)}>{k === 'all' ? `すべて (${sources.length})` : `${k} (${sources.filter(s => s.kind === k).length})`}</button>)}
          </div>
          {srcLoading && <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>ソースを取得中...</div>}
          {!srcLoading && sources.length === 0 && <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>ソースがありません。「🔄 ソースを再取得」を押してください。</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {sources.filter(s => srcKind === 'all' || s.kind === srcKind).map((s, i) => (
              <div key={i} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: s.kind === 'トレンド' ? '#2563eb' : s.kind === '競合' ? '#dc2626' : '#0891b2', padding: '1px 7px', borderRadius: 10 }}>{s.kind}</span>
                  <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 'auto' }}>{s.meta}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 }}>{s.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {s.ref && /^https?:/.test(s.ref) && <a href={s.ref} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: '#2563eb' }}>元情報 ↗</a>}
                  <button onClick={() => draftFromSource(s)} style={{ ...miniBtn, marginLeft: 'auto', background: 'var(--ink)', color: '#fff', border: 'none' }}>→ AI草案化</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== タブ: リサーチアジェンダ ===== */}
      {tab === 'agenda' && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>「次に何を調べるべきか」のバックログ。配信実績・反応・網羅の穴をもとにAIが優先度付きで起案。テーマを「→ 草案を作る」で配信物に昇格させる。</div>
          {agenda.length === 0 && <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>アジェンダが空です。「🧠 次のテーマをAI提案」を押すと、配信の穴から研究テーマを自動起案します。</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...agenda].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || ({ high: 0, mid: 1, low: 2 }[a.priority] - { high: 0, mid: 1, low: 2 }[b.priority])).map(a => (
              <div key={a.id} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, opacity: a.status === 'done' ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: prioColor[a.priority], padding: '1px 7px', borderRadius: 10 }}>優先{prioLabel[a.priority]}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: catColor[a.category] || '#666', padding: '1px 7px', borderRadius: 10 }}>{a.category}</span>
                  {a.products.map(p => <span key={p} style={{ fontSize: 9, background: 'var(--bg)', border: '0.5px solid var(--b1)', color: 'var(--ink2)', padding: '1px 6px', borderRadius: 10 }}>{p}</span>)}
                  <span style={{ fontSize: 9, color: 'var(--muted)' }}>{a.source === 'ai' ? '🧠 AI起案' : '✍️ 手動'}</span>
                  <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 'auto' }}>{a.status === 'proposed' ? '未着手' : a.status === 'researching' ? '調査中' : '完了'}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 }}>{a.topic}</div>
                {a.rationale && <div style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.5 }}>💭 {a.rationale}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {a.status !== 'done' && <button onClick={() => draftFromAgenda(a)} style={{ ...miniBtn, background: 'var(--ink)', color: '#fff', border: 'none' }}>→ 草案を作る</button>}
                  {a.status !== 'researching' && a.status !== 'done' && <button onClick={() => patchAgenda(a.id, { status: 'researching' })} style={miniBtn}>調査中に</button>}
                  {a.status !== 'done' ? <button onClick={() => patchAgenda(a.id, { status: 'done' })} style={miniBtn}>完了に</button> : <button onClick={() => patchAgenda(a.id, { status: 'proposed' })} style={miniBtn}>戻す</button>}
                  <button onClick={() => removeAgenda(a.id)} style={{ ...miniBtn, color: 'var(--muted)', marginLeft: 'auto' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== タブ: 配信＆学習 ===== */}
      {tab === 'delivery' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>プロダクト別 配信網羅</div>
              {OUR_PRODUCTS.map(p => {
                const max = Math.max(1, ...OUR_PRODUCTS.map(x => cov.byProduct[x]))
                return (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink2)', width: 140, flexShrink: 0 }}>{p}</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${(cov.byProduct[p] / max) * 100}%`, height: '100%', background: cov.byProduct[p] === 0 ? '#dc2626' : '#2563eb' }} /></div>
                    <span style={{ fontSize: 11, color: cov.byProduct[p] === 0 ? '#dc2626' : 'var(--ink2)', width: 28, textAlign: 'right' }}>{cov.byProduct[p]}</span>
                  </div>
                )
              })}
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>0件＝赤。網羅の穴は「🎯 リサーチアジェンダ」のAI提案で埋められます。</div>
            </div>
            <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>カテゴリ別 反応（刺さり度）</div>
              {CATEGORIES.map(c => {
                const max = Math.max(1, ...CATEGORIES.map(x => cov.engByCat[x]))
                return (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink2)', width: 96, flexShrink: 0 }}>{c}</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${(cov.engByCat[c] / max) * 100}%`, height: '100%', background: catColor[c] }} /></div>
                    <span style={{ fontSize: 11, color: 'var(--ink2)', width: 48, textAlign: 'right' }}>{cov.byCat[c]}件/反応{cov.engByCat[c]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>📰 従業員向け リサーチダイジェスト</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>直近に配信した反応の高い公開インサイトを、従業員がSlackでさっと読める形にまとめます。右上の「📰 ダイジェストを生成」から。</div>
          {!digest && !digestLoading && <div style={{ padding: '16px 0', color: 'var(--muted)', fontSize: 12 }}>まだ生成されていません。</div>}
          {digestLoading && <div style={{ padding: '16px 0', color: 'var(--muted)', fontSize: 12 }}>📰 生成中...</div>}
          {digest && (
            <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button onClick={copyDigest} style={miniBtn}>{digestCopied ? '✓ コピーしました' : '📋 コピー'}</button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--ink2)', lineHeight: 1.7, fontFamily: 'inherit', margin: 0 }}>{digest}</pre>
            </div>
          )}
        </>
      )}

      {/* ===== タブ: スキル&ブリーフ ===== */}
      {tab === 'skill' && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>担当者の「判断の土台」。ここに書いた方針・品質基準・訴求原則は、草案化・テーマ提案・ダイジェスト・セルフレビューの<b>すべてのAI生成に自動で注入</b>されます。反応データから育てていくほど出力が賢くなります。</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, alignItems: 'start' }}>
            {/* ブリーフ編集 */}
            <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>🧠 リサーチャー・ブリーフ</div>
                <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>{briefUpdatedAt ? '最終更新 ' + briefUpdatedAt.slice(0, 10) : '未保存'}</span>
                <button onClick={() => setBriefDraft(DEFAULT_BRIEF)} style={miniBtn}>既定値を挿入</button>
              </div>
              <textarea value={briefDraft} onChange={e => setBriefDraft(e.target.value)} style={{ ...inp, minHeight: 360, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
              {briefMsg && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 6 }}>{briefMsg}</div>}
              {briefDraft !== brief && <div style={{ fontSize: 11, color: '#d97706', marginTop: 6 }}>未保存の変更があります。右上の「💾 ブリーフを保存」で反映してください。</div>}
            </div>

            {/* 自己学習 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>📈 反応からの学び</div>
                {(() => {
                  const ranked = CATEGORIES.map(c => ({ c, eng: cov.engByCat[c], n: cov.byCat[c] })).sort((a, b) => b.eng - a.eng)
                  const best = ranked[0], worst = [...ranked].reverse().find(r => r.n > 0) || ranked[ranked.length - 1]
                  const thinProd = OUR_PRODUCTS.filter(p => cov.byProduct[p] === 0)
                  return (
                    <div style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.7 }}>
                      <div>反応が最も高い型：<b>{best?.eng > 0 ? `${best.c}（反応${best.eng}）` : 'まだデータ不足'}</b></div>
                      <div>伸びしろ：<b>{worst && worst.eng < (best?.eng || 0) ? `${worst.c}（反応${worst.eng}）` : '—'}</b></div>
                      <div>配信ゼロのプロダクト：<b style={{ color: thinProd.length ? '#dc2626' : 'var(--ink2)' }}>{thinProd.length ? thinProd.join('、') : 'なし（網羅OK）'}</b></div>
                    </div>
                  )
                })()}
                <button onClick={extractLearnings} disabled={learnLoading} style={{ ...btnPrimary, width: '100%', marginTop: 10, opacity: learnLoading ? 0.6 : 1 }}>{learnLoading ? '🧠 抽出中...' : '🧠 反応から学びを抽出（ブリーフ更新案）'}</button>
                {learnSuggestion && (
                  <div style={{ marginTop: 10, background: 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 6, padding: 10 }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: 'var(--ink2)', lineHeight: 1.6, fontFamily: 'inherit', margin: 0 }}>{learnSuggestion}</pre>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={appendLearningsToBrief} style={{ ...miniBtn, background: 'var(--ink)', color: '#fff', border: 'none' }}>＋ ブリーフ草案に追記</button>
                      <button onClick={() => setLearnSuggestion('')} style={miniBtn}>破棄</button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>使い方：①反応が溜まったら「学びを抽出」②内容を確認して草案に追記③「保存」で次回以降のAI生成に反映。これを繰り返すほど担当者の精度が上がります。</div>
            </div>
          </div>
        </>
      )}

      {/* 作成・編集モーダル */}
      {showForm && (
        <div style={overlay} onClick={() => !saving && setShowForm(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{editId ? 'インサイトを編集' : 'インサイトを作成'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button>
            </div>

            {/* AIアシスト */}
            {!editId && (
              <div style={{ background: 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>🤖 AIアシスト（情報源を貼ると草案を自動生成）</div>
                <textarea value={aiSource} onChange={e => setAiSource(e.target.value)} placeholder="競合記事・ニュース・ナレッジ等の本文を貼り付け" style={{ ...inp, minHeight: 90, resize: 'vertical' }} />
                <button onClick={() => runAi()} disabled={aiLoading} style={{ ...btnPrimary, width: '100%', marginTop: 8, opacity: aiLoading ? 0.6 : 1 }}>{aiLoading ? '🤖 生成中...' : '🤖 AIで骨子を生成'}</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={lbl}>タイトル<input value={form.title} onChange={e => setF('title', e.target.value)} style={inp} placeholder="一目で要点が分かる見出し" /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={lbl}>カテゴリ<select value={form.category} onChange={e => setF('category', e.target.value)} style={inp}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
                <label style={lbl}>状態<select value={form.status} onChange={e => setF('status', e.target.value as 'draft' | 'published')} style={inp}><option value="published">公開</option><option value="draft">下書き</option></select></label>
              </div>
              <div>
                <div style={lblText}>関連プロダクト</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {OUR_PRODUCTS.map(p => <button key={p} onClick={() => toggleProduct(p)} style={chip(form.products.includes(p))}>{p}</button>)}
                </div>
              </div>
              <label style={lbl}>要点（サマリー）<textarea value={form.summary} onChange={e => setF('summary', e.target.value)} style={{ ...inp, minHeight: 54, resize: 'vertical' }} placeholder="2〜3文で" /></label>
              <label style={lbl}>キーポイント（1行に1つ）<textarea value={form.points.join('\n')} onChange={e => setF('points', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="箇条書きを改行区切りで" /></label>
              <label style={lbl}>自社事業との関わり<textarea value={form.relevance} onChange={e => setF('relevance', e.target.value)} style={{ ...inp, minHeight: 48, resize: 'vertical' }} placeholder="どのプロダクト/施策にどう効くか" /></label>
              <label style={lbl}>従業員への示唆（So What）<textarea value={form.soWhat} onChange={e => setF('soWhat', e.target.value)} style={{ ...inp, minHeight: 48, resize: 'vertical' }} placeholder="学び・気づき" /></label>
              <label style={lbl}>推奨アクション（1行に1つ）<textarea value={form.actions.join('\n')} onChange={e => setF('actions', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} style={{ ...inp, minHeight: 48, resize: 'vertical' }} placeholder="従業員が取れる具体アクション" /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={lbl}>ソース（URL等・任意）<input value={form.sourceRef} onChange={e => setF('sourceRef', e.target.value)} style={inp} placeholder="https://..." /></label>
                <label style={lbl}>作成者（任意）<input value={form.author} onChange={e => setF('author', e.target.value)} style={inp} placeholder="リサーチャー名" /></label>
              </div>

              {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
            </div>

            {review && (
              <div style={{ marginTop: 12, background: 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>🔍 品質セルフレビュー</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: review.score >= 80 ? '#16a34a' : review.score >= 60 ? '#d97706' : '#dc2626', marginLeft: 'auto' }}>{review.score}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>/100</span>
                </div>
                {review.strengths.length > 0 && <div style={{ marginBottom: 8 }}><div style={detailLabel}>良い点</div>{review.strengths.map((s, i) => <div key={i} style={{ ...bullet, color: '#16a34a' }}>・{s}</div>)}</div>}
                {review.improvements.length > 0 && <div><div style={{ ...detailLabel, color: '#d97706' }}>改善点</div>{review.improvements.map((s, i) => <div key={i} style={bullet}>・{s}</div>)}</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={runSelfReview} disabled={reviewLoading} style={{ ...btnGhost, marginRight: 'auto', opacity: reviewLoading ? 0.6 : 1 }} title="ブリーフの品質基準で草案を自己採点">{reviewLoading ? '🔍 採点中...' : '🔍 セルフレビュー'}</button>
              <button onClick={() => setShowForm(false)} disabled={saving} style={btnGhost}>キャンセル</button>
              <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const flabel: CSSProperties = { fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 64 }
const chip = (active: boolean): CSSProperties => ({ padding: '3px 10px', border: '0.5px solid ' + (active ? 'var(--ink)' : 'var(--b1)'), borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--ink)' : 'none', color: active ? '#fff' : 'var(--ink2)' })
const detailLabel: CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 3, letterSpacing: '0.04em' }
const detailText: CSSProperties = { fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }
const bullet: CSSProperties = { fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6, paddingLeft: 4 }
const reactBtn: CSSProperties = { fontSize: 10, padding: '4px 9px', borderRadius: 14, border: '0.5px solid var(--b1)', background: 'var(--bg)', color: 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }
const miniBtn: CSSProperties = { fontSize: 10, padding: '4px 8px', borderRadius: 4, border: '0.5px solid var(--b1)', background: 'none', color: 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnPrimary: CSSProperties = { padding: '5px 14px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost: CSSProperties = { padding: '6px 14px', background: 'none', border: '0.5px solid var(--b1)', color: 'var(--muted)', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modal: CSSProperties = { background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 24, width: 540, fontFamily: 'inherit', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: '90vh', overflowY: 'auto' }
const lbl: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted)', fontFamily: 'inherit' }
const lblText: CSSProperties = { fontSize: 11, color: 'var(--muted)', marginBottom: 6 }
const inp: CSSProperties = { border: '0.5px solid var(--b1)', borderRadius: 4, padding: '7px 9px', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', width: '100%', boxSizing: 'border-box' }
