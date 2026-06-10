'use client'
import { useState, useRef } from 'react'

type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'waiting' | 'delayed'
interface Task { id?: string; 施策: string; name: string; s: string; e: string; own: 'molts'|'samurai'|'both'; st: TaskStatus; chg: boolean; assignee?: string; blocker?: boolean; impact?: string; src?: string; 備考?: string; 背景?: string; 背景ソース?: string; phase?: string; threadUrl?: string; linkedQuestionId?: string; label?: string }
interface Question { id: string; text: string; assignee: string; status: 'unanswered'|'answered'; priority: 'high'|'normal'; linkedTask: string; src: string; createdAt?: string }
interface Extracted { summary: string; tasks: Task[]; questions: Question[]; knowledge?: any[] }
interface ReviewDisplay { name: string; oldLabel: string; newLabel: string; outcome: '承認'|'FB'|'言及なし'; fbContent?: string }

const ownerName = (t: Task) => t.assignee || (t.own === 'molts' ? 'THE MOLTS' : t.own === 'samurai' ? 'SAMURAI' : '共同')

// 改行を <br> に変換して表示（markdownライブラリは使わない）
const renderLines = (text: string) => text.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)

const stLabel: Record<TaskStatus, string> = {
  todo: '未着手', doing: '進行中', review: '定例確認', done: '完了', waiting: '対応待ち', delayed: '遅れあり'
}

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
  const [reviewResults, setReviewResults] = useState<ReviewDisplay[] | null>(null)
  const [reviewMessage, setReviewMessage] = useState('')
  const [agenda, setAgenda] = useState<string | null>(null)
  const [agendaMessage, setAgendaMessage] = useState('')
  const [agendaCopied, setAgendaCopied] = useState(false)
  const [summarySaved, setSummarySaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().slice(0, 10)
  const defaultDeadline = () => { const d = new Date(); d.setDate(d.getDate() + 21); return d.toISOString().slice(0, 10) }

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
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: `以下のMTG議事録・資料から、会議サマリー・タスク・質問・ナレッジを抽出してください。

必ずJSONのみを返し、前後に説明文・マークダウンコードブロックは不要です。

出力形式:
{
  "summary": "会議の流れと決定事項のサマリー。誰が何を言い、何が決まり、何が持ち越されたかを時系列で3〜5段落で書く",
  "tasks": [
    {
      "name": "タスク名（省略なし）",
      "deadline": "YYYY-MM-DD（言及があれば。なければ空文字）",
      "assignee": "担当者名（言及があれば）",
      "category": "施策カテゴリ（あれば）",
      "背景": "このタスクが必要なビジネス上の理由（1〜2文）"
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
  ],
  "knowledge": [
    {
      "title": "ナレッジのタイトル（内容を端的に表す見出し）",
      "label": "ナレッジの分類（自社背景／競合情報／業界インサイト／顧客事例 等）",
      "content": "ナレッジ内容（markdown形式）"
    }
  ]
}

施策カテゴリ（category）の分類基準:
- 施策1: 計測・フォーム系
- 施策2: 事例コンテンツ
- 施策3: LP制作
- 施策4: LP改修
- 施策5: CEO発信
- 施策6: リファラル
- 施策7: リファラル制度
- 上記に当てはまらない場合は「施策X」

背景の書き方:
背景は「なぜこのタスクが必要かのビジネス上の理由」を1〜2文で表現し、最後は必ず「〜するため。」で終わること。
例：計測基盤が整っていないと施策の効果が測れない。正確なKPI管理を可能にするため。

質問（questions の text）の文言は以下のルールに従うこと：
・疑問文（〜ですか？〜してください）は使わない
・「〜の状況」「〜の進捗」「〜の確認」など体言止めで書く
・圧迫感・催促感のある表現は避ける
・例：
  NG：「〇〇は完了しましたか？」「〇〇を教えてください」
  OK：「〇〇の状況」「〇〇の進捗確認」「〇〇の見通し」

---
${text.slice(0, 8000)}`
          }]
        })
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      // 新フォーマットのタスクを既存の Task 型にマッピング（登録フローはそのまま使えるようにする）
      const mappedTasks: Task[] = (parsed.tasks || []).map((t: any) => ({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        施策: t.category || '施策X',
        name: t.name,
        s: today,
        e: t.deadline || defaultDeadline(),
        own: 'both' as const,
        st: 'todo' as TaskStatus,
        chg: false,
        assignee: t.assignee || '',
        blocker: false,
        src,
        背景: t.背景 || '',
      }))

      const extracted: Extracted = {
        summary: parsed.summary || '',
        tasks: mappedTasks,
        questions: parsed.questions || [],
        knowledge: parsed.knowledge || [],
      }
      setResult(extracted)
      setSelectedTasks(new Set(mappedTasks.map((_, i) => i)))
      setSelectedQuestions(new Set((extracted.questions).map((_, i) => i)))
      setStatus('preview')

      // サマリー生成完了直後に自動保存（失敗しても取り込みは止めない）
      setSummarySaved(false)
      if (extracted.summary) {
        try {
          await fetch('/api/meeting-summaries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: `MTGサマリー ${today}`, content: extracted.summary, date: today })
          })
          setSummarySaved(true)
        } catch {}
      }
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

      // AIが分類・要約したナレッジを登録（空配列ならスキップ）。
      // /api/knowledge は1リクエストにつき1エントリを受け取るため、項目ごとにPOSTする。
      const knowledgeToAdd = result.knowledge || []
      for (let i = 0; i < knowledgeToAdd.length; i++) {
        const k = knowledgeToAdd[i]
        await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `kb_mtg_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
            title: k.title || `【${k.label || 'ナレッジ'}】${mtgName}`,
            content: k.content || '',
            label: k.label || 'その他',
            source: `${today} ${mtgName}`,
            createdAt: new Date().toISOString(),
          })
        })
      }

      // 定例確認タスクの自動更新（既存の抽出処理の後に実行）
      await updateReviewTasks()

      // 次回定例アジェンダの自動生成
      await generateAgenda(tasksToAdd)

      setStatus('done')
    } catch (e) {
      setError('登録に失敗しました')
    }
    setRegistering(false)
  }

  const updateReviewTasks = async () => {
    setReviewResults(null)
    setReviewMessage('')
    try {
      // 1. 現在のタスク一覧を取得
      const tRes = await fetch('/api/tasks')
      const fetched = await tRes.json().catch(() => [])
      const list: Task[] = Array.isArray(fetched) ? fetched : []

      // 2. 定例確認（review）タスクのみ抽出
      const reviewTasks = list.filter(t => t.st === 'review')

      // 3. 0件ならスキップ
      if (reviewTasks.length === 0) {
        setReviewMessage('定例確認中のタスクはありません')
        return
      }

      // 4. Claude で議事録との照合
      const taskPayload = reviewTasks.map(t => ({ taskId: (t as any).id || t.name, name: t.name, 施策: t.施策 }))
      const prompt = `以下は週次定例MTGの議事録です。
その後に「定例確認中のタスク一覧」があります。

各タスクについて、この議事録の中で言及・議論されているか判定し、
結果とFB内容を抽出してください。

議事録：
${text.slice(0, 12000)}

定例確認中のタスク一覧（JSON）：
${JSON.stringify(taskPayload, null, 2)}

JSONのみ返してください：
{
  "results": [
    {
      "taskId": "タスクのidまたは識別子",
      "mentioned": true,
      "outcome": "承認" または "FB" または "言及なし",
      "fbContent": "FBがある場合のみ内容を記載"
    }
  ]
}

タスク名が議事録中で完全一致しない場合は意味的に照合すること。
確信が持てない場合は「言及なし」にすること。`

      const aiRes = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const aiData = await aiRes.json()
      const rawText = aiData.content?.[0]?.text || ''

      let parsed: { results?: any[] } | null = null
      try { parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim()) } catch { parsed = null }

      if (!parsed || !Array.isArray(parsed.results)) {
        setReviewMessage('定例確認の解析に失敗しました（応答をJSONとして読み取れませんでした）')
        return
      }

      // 5. 照合結果をもとにタスクを更新
      const display: ReviewDisplay[] = []
      const updated = list.map(t => {
        if (t.st !== 'review') return t
        const key = (t as any).id || t.name
        const r = parsed!.results!.find((x: any) => x.taskId === key || x.taskId === t.name || x.taskId === (t as any).id)

        if (r && r.outcome === '承認') {
          display.push({ name: t.name, oldLabel: stLabel['review'], newLabel: stLabel['done'], outcome: '承認' })
          return { ...t, st: 'done' as TaskStatus }
        }
        if (r && r.outcome === 'FB') {
          const fb = `[定例FB ${today}] ${r.fbContent || ''}`.trim()
          const newMemo = t.備考 ? `${t.備考}\n${fb}` : fb
          display.push({ name: t.name, oldLabel: stLabel['review'], newLabel: stLabel['doing'], outcome: 'FB', fbContent: r.fbContent })
          return { ...t, st: 'doing' as TaskStatus, 備考: newMemo }
        }
        // 言及なし（またはマッチなし）→ 変更なし
        display.push({ name: t.name, oldLabel: stLabel[t.st], newLabel: stLabel[t.st], outcome: '言及なし' })
        return t
      })

      // 6. 全置換保存
      await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
      setReviewResults(display)
    } catch (e) {
      setReviewMessage('定例確認タスクの更新中にエラーが発生しました')
    }
  }

  const generateAgenda = async (addedTasks: Task[]) => {
    setAgenda(null)
    setAgendaMessage('')
    setAgendaCopied(false)
    try {
      // 登録後の最新タスク一覧を取得（完了以外をアクティブとして扱う）
      const tRes = await fetch('/api/tasks')
      const fetched = await tRes.json().catch(() => [])
      const list: Task[] = Array.isArray(fetched) ? fetched : []
      const activeTasks = list.filter(t => t.st !== 'done')

      // 前回確定アジェンダ（先頭1件）
      let prevAgenda = 'なし'
      try {
        const aRes = await fetch('/api/agendas')
        const aData = await aRes.json()
        if (Array.isArray(aData) && aData[0]?.content) prevAgenda = aData[0].content
      } catch {}

      if (activeTasks.length === 0 && prevAgenda === 'なし') {
        setAgendaMessage('次回アジェンダの対象タスクはありません')
        return
      }

      const teamName = (t: Task) => t.own === 'molts' ? 'THE MOLTS' : t.own === 'samurai' ? 'SAMURAI' : '共同'
      const stJp: Record<string, string> = { todo: '未着手', doing: '進行中', 'thread-review': 'スレッド確認中', review: '定例確認', done: '完了', waiting: '対応待ち', delayed: '遅れあり' }
      const taskData = activeTasks.map(t => ({
        name: t.name, assignee: ownerName(t), 担当チーム: teamName(t),
        施策: t.施策 || '未分類', status: stJp[t.st] || t.st, 期限: t.e,
        背景: t.背景 || '', 備考: t.備考 || '', threadUrl: t.threadUrl || '',
      }))

      const prompt = `以下のデータをもとに、週次定例MTGのアジェンダを作成してください。

今日の日付：${today}
タスク一覧（JSON）：${JSON.stringify(taskData, null, 2)}
前回確定アジェンダ：${prevAgenda}

【出力形式】
markdownは使わない。記号は・と①②③のみ。

📋 定例アジェンダ（${today}）

1. 前回アクションの確認
前回アジェンダがある場合のみ出力。
前回のネクストアクションがどうなったかを確認する項目を列挙。
「なし」の場合はこのセクションを省略。

2. 施策別の進捗
タスクを施策（カテゴリ）ごとにグループ化して表示。
各施策の中でアクティブなタスク（完了以外）を示す。
通常進行中は「進行中」と一言。課題があるものは詳しく。
タスクがないカテゴリは省略。

3. 課題・意思決定事項
以下を分けて表示：
【今日決めること】
・定例確認ステータスのタスク + 背景 + 確認してほしいこと
【Slackで確認中】
・スレッド確認中ステータスのタスク + threadUrlがあればURL

4. 次週アクション
今日から7日以内に期限があるタスク（未完了）を列挙。
担当者名を含める。

※ 対象が0件のセクションは省略
※ 通常進行中で課題がないタスクは施策別セクション以外に出さない`

      const aiRes = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const aiData = await aiRes.json()
      const out = aiData.content?.[0]?.text || ''
      if (out.trim()) setAgenda(out)
      else setAgendaMessage('アジェンダの生成に失敗しました')
    } catch (e) {
      setAgendaMessage('アジェンダの生成中にエラーが発生しました')
    }
  }

  const copyAgenda = async () => {
    if (!agenda) return
    try {
      await navigator.clipboard.writeText(agenda)
      setAgendaCopied(true)
      setTimeout(() => setAgendaCopied(false), 2000)
    } catch {}
  }

  const reset = () => { setText(''); setMtgName(''); setResult(null); setStatus('idle'); setError(''); setReviewResults(null); setReviewMessage(''); setAgenda(null); setAgendaMessage(''); setAgendaCopied(false); setSummarySaved(false) }

  const outcomeColor: Record<ReviewDisplay['outcome'], { fg: string; bg: string }> = {
    '承認': { fg: 'var(--green)', bg: 'var(--gbg)' },
    'FB': { fg: '#1d4ed8', bg: '#eff6ff' },
    '言及なし': { fg: 'var(--muted)', bg: 'var(--bg)' },
  }

  const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '0.5px solid var(--b1)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: 'var(--paper)', color: 'var(--ink)', boxSizing: 'border-box' }

  return (
    <div>
      <div className="pg-title">MTGデータ取り込み</div>
      <div className="pg-sub">議事録・資料をアップロードして、タスクと質問を自動抽出します</div>

      {status === 'done' ? (
        <div>
          <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>登録完了しました</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>タスクトラッカー・質問シートに反映されました</div>
            <button onClick={reset} style={{ padding: '7px 20px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>続けて取り込む</button>
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="sh" style={{ marginBottom: 8 }}>📋 定例確認タスクの更新結果</div>
            {reviewMessage && (
              <div style={{ padding: '12px 14px', background: 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 6, fontSize: 12, color: 'var(--muted)' }}>{reviewMessage}</div>
            )}
            {reviewResults && reviewResults.map((r, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 6, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{r.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3, color: outcomeColor[r.outcome].fg, background: outcomeColor[r.outcome].bg }}>
                    {r.outcome === '言及なし' ? '言及なし（変更なし）' : r.outcome}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.oldLabel} → {r.newLabel}</span>
                </div>
                {r.fbContent && <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 4, whiteSpace: 'pre-wrap' }}>FB: {r.fbContent}</div>}
              </div>
            ))}
          </div>

          {(agenda || agendaMessage) && (
            <div style={{ marginTop: 20 }}>
              <div className="sh" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📋 次回定例アジェンダ（案）</span>
                {agenda && (
                  <button onClick={copyAgenda}
                    style={{ padding: '3px 10px', background: agendaCopied ? 'var(--gbg)' : 'none', border: '0.5px solid ' + (agendaCopied ? 'var(--green)' : 'var(--b1)'), borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: agendaCopied ? 'var(--green)' : 'var(--ink2)', textTransform: 'none', letterSpacing: 'normal' }}>
                    {agendaCopied ? '✓ コピーしました' : '📋 コピー'}
                  </button>
                )}
              </div>
              {agendaMessage
                ? <div style={{ padding: '12px 14px', background: 'var(--bg)', border: '0.5px solid var(--b1)', borderRadius: 6, fontSize: 12, color: 'var(--muted)' }}>{agendaMessage}</div>
                : <div style={{ padding: '14px 16px', background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 6, fontSize: 12, lineHeight: 1.7, color: 'var(--ink)' }}>{renderLines(agenda || '')}</div>}
            </div>
          )}
        </div>
      ) : status === 'preview' && result ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>抽出結果プレビュー</div>
            <button onClick={reset} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>← やり直す</button>
          </div>

          {result.summary && (
            <div style={{ marginBottom: 16 }}>
              <div className="sh" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📝 会議サマリー</span>
                {summarySaved && <span style={{ fontSize: 10, color: 'var(--green)', textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>📝 サマリーを保存しました</span>}
              </div>
              <div style={{ padding: '14px 16px', background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 6, fontSize: 12, lineHeight: 1.8, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{result.summary}</div>
            </div>
          )}

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
