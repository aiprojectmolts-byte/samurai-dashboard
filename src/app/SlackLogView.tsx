'use client'
import { useState, useEffect } from 'react'

interface SlackMessage {
  id: string
  channel: string
  user: string
  text: string
  ts: string
  createdAt: string
}

interface Members { samurai: string[]; molts: string[] }
interface Props { members: Members }

export default function SlackLogView({ members: _members }: Props) {
  const [logs, setLogs] = useState<SlackMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [extractResult, setExtractResult] = useState('')
  const [savingKnowledge, setSavingKnowledge] = useState(false)
  const [knowledgeResult, setKnowledgeResult] = useState('')

  useEffect(() => {
    fetch('/api/slack-logs').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setLogs(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const extractCompetitors = async () => {
    if (logs.length === 0) return
    setExtracting(true)
    setExtractResult('')
    try {
      const recentLogs = logs.slice(0, 100).map(l => l.text).join('\n')
      const aiRes = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `以下のSlackログから競合サービス・競合会社への言及を抽出してください。
SAMURAI ARCHITECTSの自社プロダクト（Rendery・knock knock AI・VISIOAL・カスタムソリューション）の競合になりそうなサービス・会社名を見つけてください。

以下の形式でJSONのみ返してください：
{"competitors": [{"name": "競合名", "relatedProduct": "関連する自社プロダクト", "summary": "どんな文脈で言及されていたか", "rawText": "該当するSlackメッセージ"}]}

競合への言及がなければ {"competitors": []} を返してください。

Slackログ：
${recentLogs.slice(0, 5000)}`
          }]
        })
      })
      const aiData = await aiRes.json()
      const aiText = aiData.content?.[0]?.text || '{}'
      let result: any = { competitors: [] }
      try { result = JSON.parse(aiText.replace(/```json|```/g, '').trim()) } catch {}
      console.log('knowledge AI result:', aiText.slice(0, 300))

      if (result.competitors?.length === 0) {
        setExtractResult('競合への言及は見つかりませんでした')
        setExtracting(false)
        return
      }

      // 競合情報に自動登録
      for (const comp of result.competitors) {
        await fetch('/api/competitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `comp_slack_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            competitorName: comp.name,
            relatedProduct: comp.relatedProduct || 'その他',
            source: 'Slack',
            sourceType: 'slack',
            rawText: comp.rawText || '',
            summary: comp.summary || '',
            companyName: comp.name,
            features: [],
            weaknesses: [],
            createdAt: new Date().toISOString()
          })
        })
      }
      setExtractResult(`${result.competitors.length}件の競合情報を競合情報ページに登録しました：\n${result.competitors.map((c: any) => `・${c.name}（${c.relatedProduct}）`).join('\n')}`)
    } catch (e) {
      setExtractResult('抽出に失敗しました')
    }
    setExtracting(false)
  }

  const extractToKnowledge = async () => {
    if (logs.length === 0) return
    setSavingKnowledge(true)
    setKnowledgeResult('')
    try {
      const logList = logs.slice(0, 100)
      const indexedLogs = logList.map((l, i) => `[${i}] ${l.text.slice(0, 80)}`).join('\n')

      // STEP1: 重要なインデックスを特定
      const step1Res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `以下のSlackログから重要なメッセージの番号を返してください。対象：商談・顧客の声・競合言及・問い合わせ・業界情報。JSONのみ：{"indices":[0,5,12]}\n\n${indexedLogs}`
          }]
        })
      })
      const step1Data = await step1Res.json()
      const step1Text = step1Data.content?.[0]?.text || '{"indices":[]}'
      let indices: number[] = []
      try { indices = JSON.parse(step1Text.replace(/```json|```/g, '').trim()).indices || [] } catch {}
      console.log('selected indices:', indices)

      if (indices.length === 0) {
        setKnowledgeResult('ナレッジとして抽出できる情報は見つかりませんでした')
        setSavingKnowledge(false)
        return
      }

      // STEP2: 選ばれたメッセージを詳細分析
      const selectedLogs = indices.slice(0, 8).map((i: number) => logList[i]?.text || '').join('\n\n---\n\n')
      const step2Res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `以下のメッセージをナレッジとして整理してください。ラベルは商談ログ/MTG議事録/参考資料/会社情報/その他から選択。JSONのみ：{"items":[{"title":"タイトル","label":"ラベル","summary":"要約","text":"原文"}]}\n\n${selectedLogs.slice(0, 2000)}`
          }]
        })
      })
      const step2Data = await step2Res.json()
      const aiText = step2Data.content?.[0]?.text || '{}'
      console.log('knowledge AI result:', aiText.slice(0, 300))
      let result: any = { items: [] }
      try { result = JSON.parse(aiText.replace(/```json|```/g, '').trim()) } catch {}

      if (result.items?.length === 0) {
        setKnowledgeResult('ナレッジとして抽出できる情報は見つかりませんでした')
        setSavingKnowledge(false)
        return
      }

      for (const item of result.items) {
        await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `kb_slack_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            filename: item.title,
            label: item.label || 'その他',
            summary: item.summary || '',
            date: new Date().toLocaleDateString('ja-JP'),
            text: item.text || '',
            createdAt: new Date().toISOString()
          })
        })
      }
      setKnowledgeResult(`${result.items.length}件をナレッジに登録しました：\n${result.items.map((i: any) => `・[${i.label}] ${i.title}`).join('\n')}`)
    } catch (e) {
      setKnowledgeResult('抽出に失敗しました')
    }
    setSavingKnowledge(false)
  }
  const formatDate = (ts: string) => {
    const d = new Date(parseFloat(ts) * 1000)
    return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="cw">
      <div style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)' }}>コミュニケーションログ</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={extractCompetitors} disabled={extracting || loading} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: extracting ? 'var(--b1)' : 'var(--ink)', color: extracting ? 'var(--muted)' : '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            {extracting ? '抽出中...' : '🔍 競合情報を抽出'}
          </button>
          <button onClick={extractToKnowledge} disabled={savingKnowledge || loading} style={{ fontSize: 11, padding: '4px 12px', border: '0.5px solid var(--b1)', borderRadius: 20, background: savingKnowledge ? 'var(--b1)' : 'var(--paper)', color: savingKnowledge ? 'var(--muted)' : 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            {savingKnowledge ? '抽出中...' : '📚 ナレッジに追加'}
          </button>
        </div>
      </div>
      {knowledgeResult && (
        <div style={{ margin: '8px 14px', background: 'var(--bbg)', border: '0.5px solid var(--blue)', borderRadius: 6, padding: 10, fontSize: 11, whiteSpace: 'pre-wrap' as const, color: 'var(--ink2)' }}>
          {knowledgeResult}
        </div>
      )}
      {extractResult && (
        <div style={{ margin: '8px 14px', background: 'var(--gbg)', border: '0.5px solid var(--green)', borderRadius: 6, padding: 10, fontSize: 11, whiteSpace: 'pre-wrap' as const, color: 'var(--ink2)' }}>
          {extractResult}
        </div>
      )}
      {loading && <div style={{ padding: '20px 14px', color: 'var(--muted)', fontSize: 12 }}>読み込み中...</div>}
      {!loading && logs.length === 0 && (
        <div style={{ padding: '20px 14px', color: 'var(--muted)', fontSize: 12 }}>
          メッセージがありません。Slackチャンネルにメッセージを投稿すると表示されます。
        </div>
      )}
      {logs.map(log => (
        <div key={log.id} className="ir">
          <div className="ib">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{log.user}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatDate(log.ts)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>{log.text}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
