'use client'
import { useState, useEffect } from 'react'

const OUR_PRODUCTS = ['Rendery', 'knock knock AI', 'VISIOAL', 'カスタムソリューション']

export default function Competitors() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [competitorName, setCompetitorName] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [inputMode, setInputMode] = useState<'url'|'text'>('url')
  const [autoDetecting, setAutoDetecting] = useState(false)
  const [search, setSearch] = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [expandedId, setExpandedId] = useState<string|null>(null)
  const [analyzingId, setAnalyzingId] = useState<string|null>(null)
  const [analysisResult, setAnalysisResult] = useState<Record<string, string>>({})
  const [addingInfoId, setAddingInfoId] = useState<string|null>(null)
  const [addInfoText, setAddInfoText] = useState('')
  const [addInfoSource, setAddInfoSource] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)

  useEffect(() => { fetchItems() }, [])

  const fetchItems = async () => {
    setLoading(true)
    const res = await fetch('/api/competitors')
    const data = await res.json()
    setItems(data)
    setLoading(false)
  }

  const autoDetectFromUrl = async (url: string) => {
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) return
    const videoId = url.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1]
    if (!videoId) return
    setAutoDetecting(true)
    try {
      // YouTube oEmbed APIでタイトルを即取得（字幕不要）
      const res = await fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`)
      const data = await res.json()
      const title = data.title || ''
      if (title && !competitorName) {
        setCompetitorName(title)
      }
    } catch (e) { console.error(e) }
    setAutoDetecting(false)
  }

    const extractText = async (): Promise<string> => {
    if (inputMode === 'text') return pasteText

    const url = urlInput.trim()
    if (!url) return ''

    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const res = await fetch('/api/youtube-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      return data.text
    }

    // 通常URL
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data.text
  }

  const register = async () => {
    if (!competitorName.trim()) { alert('競合名を入力してください'); return }

    if (inputMode === 'url' && !urlInput.trim()) { alert('URLを入力してください'); return }
    if (inputMode === 'text' && !pasteText.trim()) { alert('テキストを入力してください'); return }

    setRegistering(true)
    try {
      const text = await extractText()
      if (!text) { alert('テキストの取得に失敗しました'); setRegistering(false); return }

      // AI分析
      const aiRes = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `以下のテキストから競合サービスの情報を分析してください。

SAMURAI ARCHITECTSの自社プロダクト：
- Rendery: 建築パースをAIで生成。複数メンバーでリアルタイムコラボレーション可能
- knock knock AI: 空室写真にAIで家具を配置。不動産仲介・賃貸管理会社向け
- VISIOAL: 建築家がAIを使って企画段階の空間イメージをフォトリアルでビジュアル化するコンサルサービス
- カスタムソリューション: BIM化・図面解析・オフィスレイアウト自動生成などの受託開発

JSONのみ返してください：{
  "companyName": "会社名",
  "productName": "プロダクト・サービス名",
  "summary": "2〜3文の概要",
  "target": "ターゲット顧客",
  "features": ["主な機能・特徴1", "主な機能・特徴2", "主な機能・特徴3"],
  "weaknesses": ["弱点・できないこと1", "弱点・できないこと2"],
  "pricing": "料金体系（わかれば）",
  "relatedProduct": "最も競合する自社プロダクト名（Rendery/knock knock AI/VISIOAL/カスタムソリューション のいずれか）",
  "threat": "該当自社プロダクトへの脅威レベル（高/中/低）と理由"
}

テキスト：
${text.slice(0, 1500)}`
          }]
        })
      })
      const aiData = await aiRes.json()
      const aiText = aiData.content?.[0]?.text || '{}'
      let meta: any = {}
      try { meta = JSON.parse(aiText.replace(/```json|```/g, '').trim()) } catch {}
      console.log('AI response:', aiText.slice(0, 500))
      console.log('meta.relatedProduct:', meta.relatedProduct)

      await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `comp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          competitorName: competitorName.trim(),
          relatedProduct: meta.relatedProduct || selectedProduct || 'その他',
          source: inputMode === 'url' ? urlInput : 'テキスト入力',
          sourceType: inputMode === 'url' ? (urlInput.includes('youtube') ? 'youtube' : 'web') : 'text',
          rawText: text.slice(0, 10000),
          companyName: meta.companyName || '',
          productName: meta.productName || '',
          summary: meta.summary || '',
          target: meta.target || '',
          features: meta.features || [],
          weaknesses: meta.weaknesses || [],
          pricing: meta.pricing || '',
          threat: meta.threat || '',
          createdAt: new Date().toISOString()
        })
      })

      setUrlInput('')
      setPasteText('')
      setCompetitorName('')
      setSelectedProduct('')
      await fetchItems()
    } catch (e: any) {
      alert(`エラー: ${e.message}`)
    }
    setRegistering(false)
  }

  const saveAdditionalInfo = async (item: any) => {
    if (!addInfoText.trim()) return
    setSavingInfo(true)
    const updated = { ...item }
    updated.additionalInfo = updated.additionalInfo || []
    updated.additionalInfo.push({
      date: new Date().toLocaleDateString('ja-JP'),
      source: addInfoSource || '手動入力',
      sourceType: 'manual',
      summary: addInfoText,
      rawText: addInfoText,
      features: [],
      weaknesses: [],
    })
    await fetch('/api/competitors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    })
    setAddingInfoId(null)
    setAddInfoText('')
    setAddInfoSource('')
    await fetchItems()
    setSavingInfo(false)
  }

  const analyzeVsOurs = async (item: any) => {
    setAnalyzingId(item.id)
    try {
      const aiRes = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `SAMURAI ARCHITECTSの${item.relatedProduct}と競合「${item.competitorName}」のマーケティング分析をしてください。

【競合情報】
- 会社名: ${item.companyName}
- 概要: ${item.summary}
- ターゲット: ${item.target}
- 機能: ${item.features?.join(', ')}
- 弱点: ${item.weaknesses?.join(', ')}
- 料金: ${item.pricing}

以下の観点でマーケ視点の分析をしてください：
1. 差別化ポイント（${item.relatedProduct}が勝てる点）
2. 負けている点・注意すべき点
3. 発信戦略への示唆（どんなコンテンツで差別化を打ち出すべきか）
4. 狙えるポジション

日本語で、具体的に答えてください。`
          }]
        })
      })
      const aiData = await aiRes.json()
      const result = aiData.content?.[0]?.text || ''
      setAnalysisResult(prev => ({ ...prev, [item.id]: result }))
      setExpandedId(item.id)
    } catch (e) {
      alert('分析に失敗しました')
    }
    setAnalyzingId(null)
  }

  const deleteItem = async (id: string) => {
    if (!confirm('削除しますか？')) return
    await fetch('/api/competitors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const threatColor = (t: string) => {
    if (t?.includes('高')) return 'var(--red)'
    if (t?.includes('中')) return '#f59e0b'
    return 'var(--green)'
  }

  const filtered = items.filter(i => {
    const matchProduct = !filterProduct || i.relatedProduct === filterProduct
    const matchSearch = !search || i.competitorName.includes(search) || i.summary?.includes(search) || i.companyName?.includes(search)
    return matchProduct && matchSearch
  })

  return (
    <div className="pg">
      <div className="pg-title">競合情報</div>
      <div className="pg-sub">競合サービスをYouTube・URL・テキストから登録し、自社プロダクトとのマーケ分析を行います。</div>

      {/* 登録フォーム */}
      <div style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 12 }}>＋ 競合情報を登録</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={competitorName} onChange={e => setCompetitorName(e.target.value)} placeholder="競合サービス名 *" style={{ flex: 1, padding: '6px 10px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)' }} />
          <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} style={{ flex: 1, padding: '6px 10px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)' }}>
            <option value="">関連自社プロダクト *</option>
            {OUR_PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button onClick={() => setInputMode('url')} style={{ fontSize: 11, padding: '3px 12px', borderRadius: 10, border: '0.5px solid var(--b1)', background: inputMode === 'url' ? 'var(--ink)' : 'none', color: inputMode === 'url' ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>URL / YouTube</button>
          <button onClick={() => setInputMode('text')} style={{ fontSize: 11, padding: '3px 12px', borderRadius: 10, border: '0.5px solid var(--b1)', background: inputMode === 'text' ? 'var(--ink)' : 'none', color: inputMode === 'text' ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>テキスト貼り付け</button>
        </div>
        {inputMode === 'url' ? (
          <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onBlur={e => autoDetectFromUrl(e.target.value)} placeholder="https://youtube.com/watch?v=... または https://..." style={{ width: '100%', padding: '6px 10px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)', boxSizing: 'border-box' as const, marginBottom: 8 }} />
        ) : (
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="競合サービスの説明文やNotebookLM出力を貼り付け..." style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)', minHeight: 80, resize: 'vertical' as const, boxSizing: 'border-box' as const, marginBottom: 8 }} />
        )}
        {autoDetecting && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>🔍 サービス名を自動取得中...</div>}
        <button onClick={register} disabled={registering || autoDetecting} style={{ padding: '6px 20px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {registering ? '分析・登録中...' : '🔍 分析して登録'}
        </button>
      </div>

      {/* 検索＆フィルター */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="競合名・概要で検索..." style={{ flex: 1, padding: '6px 10px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit', background: 'var(--paper)' }} />
        <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} style={{ padding: '6px 10px', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'inherit', background: 'var(--paper)' }}>
          <option value="">全プロダクト</option>
          {OUR_PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* 一覧 */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: 20, textAlign: 'center' as const }}>
          {items.length === 0 ? 'まだデータがありません' : '該当なし'}
        </div>
      ) : filtered.map(item => (
        <div key={item.id} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' as const }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{item.competitorName}</span>
                {item.companyName && item.companyName !== item.competitorName && (
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>({item.companyName})</span>
                )}
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--bbg)', color: 'var(--blue)', fontWeight: 600 }}>{item.relatedProduct}</span>
                {item.threat && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--bg)', color: threatColor(item.threat), fontWeight: 600, border: `0.5px solid ${threatColor(item.threat)}` }}>
                    脅威: {item.threat.split('と')[0].split('（')[0].trim()}
                  </span>
                )}
                {item.sourceType === 'youtube' && <span style={{ fontSize: 10, color: 'var(--muted)' }}>▶ YouTube</span>}
              </div>
              {item.summary && <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 6, lineHeight: 1.6 }}>{item.summary}</div>}
              {item.target && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>🎯 {item.target}</div>}
              {item.features?.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  {item.features.map((f: string, i: number) => (
                    <span key={i} style={{ fontSize: 10, background: 'var(--gbg)', color: 'var(--green)', padding: '2px 8px', borderRadius: 10, marginRight: 4, marginBottom: 4, display: 'inline-block' }}>✓ {f}</span>
                  ))}
                </div>
              )}
              {item.weaknesses?.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  {item.weaknesses.map((w: string, i: number) => (
                    <span key={i} style={{ fontSize: 10, background: 'var(--rbg)', color: 'var(--red)', padding: '2px 8px', borderRadius: 10, marginRight: 4, marginBottom: 4, display: 'inline-block' }}>✕ {w}</span>
                  ))}
                </div>
              )}
              {item.pricing && <div style={{ fontSize: 11, color: 'var(--muted)' }}>💰 {item.pricing}</div>}
            </div>
            <button onClick={() => deleteItem(item.id)} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}>✕</button>
          </div>

          {/* 追加情報 */}
          {item.additionalInfo?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>📌 追加情報（{item.additionalInfo.length}件）</div>
              {item.additionalInfo.map((info: any, i: number) => (
                <div key={i} style={{ background: 'var(--bg)', borderRadius: 4, padding: '6px 10px', marginBottom: 4, fontSize: 11, borderLeft: '2px solid var(--b1)' }}>
                  <span style={{ color: 'var(--muted)', marginRight: 6 }}>{info.date} [{info.source}]</span>
                  {info.summary}
                </div>
              ))}
            </div>
          )}

          {/* 情報追加フォーム */}
          {addingInfoId === item.id && (
            <div style={{ marginTop: 8, background: 'var(--bg)', borderRadius: 6, padding: 10 }}>
              <input value={addInfoSource} onChange={e => setAddInfoSource(e.target.value)} placeholder="ソース（Slack・URL・メモなど）" style={{ width: '100%', padding: '4px 8px', border: '0.5px solid var(--b1)', borderRadius: 4, fontSize: 11, fontFamily: 'inherit', marginBottom: 6, boxSizing: 'border-box' as const }} />
              <textarea value={addInfoText} onChange={e => setAddInfoText(e.target.value)} placeholder="追加情報を入力..." style={{ width: '100%', padding: '4px 8px', border: '0.5px solid var(--b1)', borderRadius: 4, fontSize: 11, fontFamily: 'inherit', minHeight: 60, resize: 'vertical' as const, marginBottom: 6, boxSizing: 'border-box' as const }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => saveAdditionalInfo(item)} disabled={savingInfo} style={{ padding: '3px 12px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>保存</button>
                <button onClick={() => { setAddingInfoId(null); setAddInfoText(''); setAddInfoSource('') }} style={{ padding: '3px 12px', background: 'none', border: '0.5px solid var(--b1)', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>キャンセル</button>
              </div>
            </div>
          )}

          {/* マーケ分析ボタン */}
          <div style={{ marginTop: 10, borderTop: '0.5px solid var(--b1)', paddingTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => analyzeVsOurs(item)}
              disabled={analyzingId === item.id}
              style={{ fontSize: 11, padding: '4px 14px', background: analyzingId === item.id ? 'var(--b1)' : 'var(--ink)', color: analyzingId === item.id ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
            >{analyzingId === item.id ? '分析中...' : `📊 ${item.relatedProduct}との比較分析`}</button>
            <button onClick={() => { setAddingInfoId(addingInfoId === item.id ? null : item.id); setAddInfoText(''); setAddInfoSource('') }} style={{ fontSize: 11, padding: '4px 12px', background: 'none', border: '0.5px solid var(--b1)', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit' }}>＋ 情報を追加</button>
            {analysisResult[item.id] && (
              <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} style={{ fontSize: 11, color: 'var(--ink2)', background: 'none', border: '0.5px solid var(--b1)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                {expandedId === item.id ? '閉じる' : '分析結果を見る'}
              </button>
            )}
          </div>

          {/* 分析結果 */}
          {expandedId === item.id && analysisResult[item.id] && (
            <div style={{ marginTop: 10, background: 'var(--bg)', borderRadius: 6, padding: 14, fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap' as const, color: 'var(--ink2)' }}>
              {analysisResult[item.id]}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
