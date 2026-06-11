'use client'
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import {
  BRIEF_FIELDS, DEFAULT_CUSTOMER_JOURNEY, DEFAULT_BRIEF_PERSONA,
  SELF_REVIEW_CRITERIA, KATO_NOTE_EXAMPLE,
} from './components/contentBrief'

type Brief = Record<string, string>
interface SelfReview { pass: boolean; score: number; issues: string[] }

// AI応答から先頭{〜末尾}を取り出してパース（前後の説明・コードフェンスに耐える）
const extractJson = (raw: string): any => {
  const t = (raw || '').replace(/```json|```/g, '').trim()
  const s = t.indexOf('{'), e = t.lastIndexOf('}')
  if (s === -1 || e === -1 || e < s) throw new Error('AI応答からJSONを抽出できませんでした')
  return JSON.parse(t.slice(s, e + 1))
}

const MEDIA = [
  { v: 'kato_note', label: '✍️ 加藤CEO個人note' },
  { v: 'company_x', label: '𝕏 会社公式X' },
  { v: 'case', label: '📄 事例・インタビュー記事（会社名義）' },
] as const

export default function ContentBrief() {
  const [theme, setTheme] = useState('')
  const [source, setSource] = useState('')
  const [media, setMedia] = useState<string>('kato_note')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [brief, setBrief] = useState<Brief | null>(null)
  const [review, setReview] = useState<SelfReview | null>(null)
  const [verdict, setVerdict] = useState<'' | 'publish' | 'revise' | 'reject'>('')
  const [verdictSaved, setVerdictSaved] = useState(false)

  // 判断の土台（writer-persona / customer-journey）。空なら既定値。
  const [persona, setPersona] = useState(DEFAULT_BRIEF_PERSONA)
  const [journey, setJourney] = useState(DEFAULT_CUSTOMER_JOURNEY)

  useEffect(() => {
    fetch('/api/writer-persona').then(r => r.json()).then(d => { if (d?.brief?.trim()) setPersona(d.brief) }).catch(() => {})
    fetch('/api/customer-journey').then(r => r.json()).then(d => { if (d?.journey?.trim()) setJourney(d.journey) }).catch(() => {})
  }, [])

  const mediaLabel = MEDIA.find(m => m.v === media)?.label || media

  const generate = async () => {
    if (!theme.trim()) { setError('テーマ（何について書くか）を入れてください'); return }
    setLoading(true); setError(''); setBrief(null); setReview(null); setVerdict(''); setVerdictSaved(false)
    try {
      const fieldSpec = BRIEF_FIELDS.map(f => `"${f.key}": "${f.meaning}"`).join(',\n  ')
      const system = `${persona}

${journey}

${SELF_REVIEW_CRITERIA}

${KATO_NOTE_EXAMPLE}

あなたはSAMURAI ARCHITECTSのコンテンツ生成担当者です。上記の人格・読者の土台・お手本に従い、媒体「${mediaLabel}」向けの企画骨子を作ります。
手順：(1)テンプレートで企画骨子を作る →(2)自分で「自己レビュー」のA〜Jを採点し、未達があれば"出す前に自分で直す"→(3)直した最終版と、残る懸念をissuesに入れて返す。
【厳守】事実版に無い具体（人物像・数値・段階別感情）を創作しない。最大値訴求しない。加藤一人称noteはSEO/解説調にしない。

JSONのみ返す（前後の説明・コードブロック記号なし）：
{
 "brief": {
  ${fieldSpec}
 },
 "selfReview": { "pass": true または false（A〜Jを全て満たすか）, "score": 0〜100の整数, "issues": ["残る懸念や、修正しきれなかった点を0〜4個"] }
}
※outlineは大見出しのみ・改行区切り。各項目は具体的に。`
      const userMsg = `【テーマ】${theme.slice(0, 2000)}${source.trim() ? `\n\n【参考素材（あれば事実として使う／無い具体は創作しない）】\n${source.slice(0, 6000)}` : ''}`
      const res = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, system, messages: [{ role: 'user', content: userMsg }] }),
      })
      const data = await res.json()
      const raw = data.content?.find((c: any) => c.type === 'text')?.text || ''
      const p = extractJson(raw)
      const b: Brief = {}
      BRIEF_FIELDS.forEach(f => { b[f.key] = String(p.brief?.[f.key] ?? '') })
      setBrief(b)
      setReview({
        pass: !!p.selfReview?.pass,
        score: Number(p.selfReview?.score) || 0,
        issues: Array.isArray(p.selfReview?.issues) ? p.selfReview.issues.map((x: any) => String(x)) : [],
      })
    } catch (e) {
      setError('企画骨子の生成に失敗しました：' + String(e))
    }
    setLoading(false)
  }

  const saveVerdict = async (v: 'publish' | 'revise' | 'reject') => {
    if (!brief) return
    setVerdict(v)
    const note = (v === 'revise' || v === 'reject')
      ? (window.prompt(v === 'revise' ? 'どこを直したいですか？（任意）' : '却下の理由（任意）') || '')
      : ''
    try {
      await fetch('/api/plan-decisions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey: new Date().toISOString().slice(0, 10) + '::' + (brief.title || theme).slice(0, 40),
          title: brief.title || '', verdict: v, note, source: 'content-brief', media,
        }),
      })
      setVerdictSaved(true); setTimeout(() => setVerdictSaved(false), 2500)
    } catch {}
  }

  return (
    <div>
      <div className="pg-title">✍️ 企画骨子（担当者）</div>
      <div className="pg-sub">テーマ → 企画骨子 → 自己レビュー（出す前に担当者が自分でゲートを通す）→ 加藤レビュー。加藤さんの名前で“創作・浅い・SEO臭い”ものを出させないのが役目。</div>

      {/* 入力 */}
      <div style={card}>
        <div style={lbl}>発信媒体</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {MEDIA.map(m => (
            <button key={m.v} onClick={() => setMedia(m.v)} style={chip(media === m.v)}>{m.label}</button>
          ))}
        </div>
        <div style={lbl}>テーマ（何について書くか）</div>
        <textarea value={theme} onChange={e => setTheme(e.target.value)} placeholder="例：工務店とAI。AIに何ができて何ができないか、現場の判断の話。" style={{ ...inp, minHeight: 56, marginBottom: 10 }} />
        <div style={lbl}>参考素材（任意・事実として使う。無い具体は創作しない）</div>
        <textarea value={source} onChange={e => setSource(e.target.value)} placeholder="議事録・調査データ・顧客の声などがあれば貼り付け" style={{ ...inp, minHeight: 70, marginBottom: 10 }} />
        <button onClick={generate} disabled={loading} style={{ ...btnPrimary, width: '100%', opacity: loading ? 0.6 : 1 }}>{loading ? '担当者が企画して自己レビュー中...' : '🧠 企画骨子をつくる（自己レビュー込み）'}</button>
        {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{error}</div>}
      </div>

      {/* 自己レビュー結果 */}
      {review && (
        <div style={{ ...card, borderColor: review.pass ? 'var(--green)' : '#d97706' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{review.pass ? '✅ 自己レビュー合格' : '⚠️ 自己レビュー：要確認'}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: review.score >= 80 ? 'var(--green)' : review.score >= 60 ? '#d97706' : 'var(--red)', marginLeft: 'auto' }}>{review.score}<span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>/100</span></span>
          </div>
          {review.issues.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', marginBottom: 3 }}>残る懸念</div>
              {review.issues.map((s, i) => <div key={i} style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>・{s}</div>)}
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>※自己レビューを通った骨子だけを加藤さんに見せる想定です。</div>
        </div>
      )}

      {/* 企画骨子（項目｜意味｜内容） */}
      {brief && (
        <div style={card}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>企画骨子</div>
          {BRIEF_FIELDS.map(f => (
            <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, padding: '8px 0', borderTop: '0.5px solid var(--b1)' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{f.label}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>{f.meaning}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{brief[f.key] || '—'}</div>
            </div>
          ))}

          {/* 加藤レビュー */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--b1)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>加藤さんレビュー（出すかどうかの最終判断）</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {([['publish', '✅ 出したい', 'var(--green)', 'var(--gbg)'], ['revise', '✏️ 直したい', '#d97706', '#fffbeb'], ['reject', '✖️ 却下', 'var(--red)', 'var(--rbg)']] as const).map(([v, label, col, bg]) => (
                <button key={v} onClick={() => saveVerdict(v)} style={{ fontSize: 11, padding: '5px 14px', borderRadius: 16, border: '0.5px solid ' + (verdict === v ? col : 'var(--b1)'), background: verdict === v ? bg : 'none', color: verdict === v ? col : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: verdict === v ? 700 : 500 }}>{label}</button>
              ))}
              {verdictSaved && <span style={{ fontSize: 10, color: 'var(--green)' }}>✓ 記録しました</span>}
            </div>
          </div>
        </div>
      )}

      {!brief && !loading && (
        <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>テーマを入れて「企画骨子をつくる」を押すと、担当者が企画→自己レビューまで一度に行います。</div>
      )}
    </div>
  )
}

const card: CSSProperties = { background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 14, marginBottom: 14 }
const lbl: CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }
const inp: CSSProperties = { border: '0.5px solid var(--b1)', borderRadius: 4, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 }
const chip = (active: boolean): CSSProperties => ({ padding: '4px 12px', border: '0.5px solid ' + (active ? 'var(--ink)' : 'var(--b1)'), borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--ink)' : 'none', color: active ? '#fff' : 'var(--ink2)' })
const btnPrimary: CSSProperties = { padding: '8px 14px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
