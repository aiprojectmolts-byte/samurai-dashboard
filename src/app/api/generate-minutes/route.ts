import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const KEY = 'samurai:materials'
const contentKeyFor = (id: string) => `samurai:material-content:${id}`

const esc = (s: any) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

type Utterance = { ts: string; sec: number; speaker: string; text: string }

// VTT を {ts, sec, speaker, text} の発言配列にパース（時・分・秒を保持）
function parseVtt(vtt: string): Utterance[] {
  const lines = String(vtt || '').replace(/\r/g, '').split('\n')
  const out: Utterance[] = []
  let curTs = '0:00'
  let curSec = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line === 'WEBVTT' || /^NOTE/.test(line)) continue
    const tsMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?)(?:\.\d+)?\s*-->/)
    if (tsMatch) {
      // HH:MM:SS / MM:SS を総秒数に変換し、mm:ss（分は60超も許容）に正規化
      const p = tsMatch[1].split(':').map(Number)
      curSec = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
      const mm = Math.floor(curSec / 60), ss = curSec % 60
      curTs = `${mm}:${String(ss).padStart(2, '0')}`
      continue
    }
    if (/^\d+$/.test(line)) continue // キュー番号
    // 話者抽出：<v Speaker>text</v> もしくは "Speaker: text"
    let speaker = ''
    const vMatch = line.match(/<v\s+([^>]+)>/i)
    if (vMatch) speaker = vMatch[1].trim()
    let text = line.replace(/<\/?v[^>]*>/gi, '').replace(/<[^>]+>/g, '').trim()
    if (!speaker) {
      const sm = text.match(/^([^:：]{1,20})[:：]\s*(.+)$/)
      if (sm) { speaker = sm[1].trim(); text = sm[2].trim() }
    }
    if (text) out.push({ ts: curTs, sec: curSec, speaker, text })
  }
  return out
}

// 発言配列を圧縮：短すぎる発言を除去 → 連続する同一話者をまとめる（タイムスタンプは保持）
function compressUtterances(utts: Utterance[]): Utterance[] {
  const filtered: Utterance[] = []
  let prevText = ''
  for (const u of utts) {
    const clean = u.text.replace(/\s+/g, '')
    if (clean.length <= 1) continue            // 1文字以下の相槌等は除去
    if (u.text === prevText) continue          // 直前と完全重複する発言は除去
    filtered.push(u)
    prevText = u.text
  }
  const merged: Utterance[] = []
  for (const u of filtered) {
    const last = merged[merged.length - 1]
    if (last && u.speaker && last.speaker === u.speaker) {
      last.text += ' ' + u.text                // 同一話者の連続発言を結合（開始tsは保持）
    } else {
      merged.push({ ...u })
    }
  }
  return merged
}

// 文字数上限を超える場合は、全時間帯をカバーするよう等間隔で間引く（先頭だけ残さない）
function buildTranscript(utts: Utterance[], maxChars: number): string {
  const fmt = (u: Utterance) => `[${u.ts}] ${u.speaker ? u.speaker + ': ' : ''}${u.text}`
  const full = utts.map(fmt).join('\n')
  if (full.length <= maxChars || utts.length === 0) return full
  const step = Math.ceil(full.length / maxChars)
  const sampled = utts.filter((_, i) => i % step === 0)
  // 終盤を必ず含めるため最後の発言を補完
  if (sampled[sampled.length - 1] !== utts[utts.length - 1]) sampled.push(utts[utts.length - 1])
  return sampled.map(fmt).join('\n')
}

function videoEmbed(videoUrl?: string): string {
  if (!videoUrl) return ''
  const u = videoUrl.trim()
  if (!u) return ''
  let inner = ''
  if (/drive\.google\.com/i.test(u)) {
    const m = u.match(/\/file\/d\/([^/]+)/) || u.match(/[?&]id=([^&]+)/)
    const id = m ? m[1] : ''
    if (id) inner = `<iframe src="https://drive.google.com/file/d/${esc(id)}/preview" allow="autoplay" allowfullscreen></iframe>`
  } else if (/youtube\.com|youtu\.be/i.test(u)) {
    const m = u.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/)
    const id = m ? m[1] : ''
    if (id) inner = `<iframe src="https://www.youtube.com/embed/${esc(id)}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
  }
  if (!inner) inner = `<video src="${esc(u)}" controls></video>`
  return `<section id="recording"><h2>録画</h2><div class="video-wrap">${inner}</div></section>`
}

function buildHtml(data: any, meta: { title: string; date: string; participants: string; videoUrl?: string }) {
  const sections: any[] = Array.isArray(data?.sections) ? data.sections : []
  const summary: any[] = Array.isArray(data?.summary) ? data.summary : (data?.summary ? [data.summary] : [])
  const decisions: any[] = Array.isArray(data?.decisions) ? data.decisions : []
  const nextActions: any[] = Array.isArray(data?.nextActions) ? data.nextActions : []

  const toc = [
    meta.videoUrl ? `<a href="#recording">録画</a>` : '',
    `<a href="#summary">サマリー</a>`,
    ...sections.map((s, i) => `<a href="#${esc(s.id || 'm' + (i + 1))}">${esc(s.title || 'セクション')}</a>`),
    decisions.length ? `<a href="#decisions">意思決定事項</a>` : '',
    nextActions.length ? `<a href="#actions">ネクストアクション</a>` : '',
  ].filter(Boolean).join('\n    ')

  const summaryHtml = summary.length
    ? `<section id="summary"><h2>サマリー</h2><div class="summary-box"><ul>${summary.map((p: any) => `<li>${esc(p)}</li>`).join('')}</ul></div></section>`
    : ''

  const sectionsHtml = sections.map((s, i) => {
    const id = esc(s.id || 'm' + (i + 1))
    const ts = s.timestamp ? `<span class="timestamp">${esc(s.timestamp)}</span>` : ''
    const points: any[] = Array.isArray(s.points) ? s.points : []
    return `<section id="${id}"><h2>${esc(s.title || 'セクション')}${ts}</h2><ul>${points.map((p: any) => `<li>${esc(p)}</li>`).join('')}</ul></section>`
  }).join('\n    ')

  const decisionsHtml = decisions.length
    ? `<section id="decisions"><h2>意思決定事項</h2><div class="decision-box"><ul>${decisions.map((d: any) => `<li>${esc(d)}</li>`).join('')}</ul></div></section>`
    : ''

  const actionsHtml = nextActions.length
    ? `<section id="actions"><h2>ネクストアクション</h2><table class="action-table"><thead><tr><th>タスク</th><th>担当者</th><th>期日</th></tr></thead><tbody>${nextActions.map((a: any) => `<tr><td>${esc(a.task)}</td><td>${esc(a.owner)}</td><td>${esc(a.due)}</td></tr>`).join('')}</tbody></table></section>`
    : ''

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(meta.title)}</title>
  <style>
    :root {
      --bg: #ffffff; --bg2: #f7f7f5; --border: #e5e5e0;
      --text: #1a1a18; --text2: #666660; --accent: #1a1a18;
      --green: #16a34a; --orange: #ea580c;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; background: var(--bg); color: var(--text); display: flex; min-height: 100vh; }
    .sidebar { width: 220px; min-width: 220px; background: var(--bg2); border-right: 1px solid var(--border); padding: 24px 16px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
    .sidebar h2 { font-size: 11px; color: var(--text2); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .sidebar a { display: block; padding: 6px 8px; border-radius: 6px; color: var(--text2); text-decoration: none; font-size: 13px; margin-bottom: 2px; transition: all 0.15s; }
    .sidebar a:hover { background: var(--border); color: var(--text); }
    .main { flex: 1; padding: 40px 48px; max-width: 900px; }
    .header { margin-bottom: 32px; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .meta { color: var(--text2); font-size: 13px; }
    section { margin-bottom: 40px; padding-top: 8px; }
    section h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    .timestamp { display: inline-block; font-size: 11px; color: var(--text2); background: var(--border); padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-family: monospace; }
    ul { list-style: none; }
    li { padding: 8px 0 8px 16px; border-left: 2px solid var(--border); margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: var(--text2); }
    .video-wrap { background: #000; border-radius: 8px; overflow: hidden; margin-bottom: 16px; aspect-ratio: 16/9; }
    .video-wrap iframe, .video-wrap video { width: 100%; height: 100%; border: 0; }
    .summary-box { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .summary-box li { border-left-color: var(--green); color: var(--text); }
    .decision-box li { border-left-color: var(--orange); }
    .action-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .action-table th { text-align: left; padding: 8px 12px; color: var(--text2); border-bottom: 1px solid var(--border); font-weight: 500; }
    .action-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
  </style>
</head>
<body>
  <nav class="sidebar">
    <h2>目次</h2>
    ${toc}
  </nav>
  <main class="main">
    <div class="header">
      <h1>${esc(meta.title)}</h1>
      <p class="meta">${esc(meta.date)}${meta.participants ? ' • ' + esc(meta.participants) : ''}</p>
    </div>
    ${videoEmbed(meta.videoUrl)}
    ${summaryHtml}
    ${sectionsHtml}
    ${decisionsHtml}
    ${actionsHtml}
  </main>
</body>
</html>`
}

export async function POST(request: Request) {
  try {
    const { vttContent, title, date, participants, videoUrl } = await request.json()
    if (!vttContent || !title || !date) {
      return NextResponse.json({ error: 'vttContent, title, date are required' }, { status: 400 })
    }
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })

    const utterances = compressUtterances(parseVtt(vttContent))
    const durationMin = utterances.length ? Math.round(utterances[utterances.length - 1].sec / 60) : 0
    const transcript = buildTranscript(utterances, 60000)
    const lastTs = utterances.length ? utterances[utterances.length - 1].ts : '0:00'

    const prompt = `以下の会議文字起こし（VTT形式）を分析して、指定のJSONフォーマットで議事録を生成してください。
発言者名・タイムスタンプも活用してください。
日本語で出力してください。
JSONのみ返してください。

文字起こしは約${durationMin}分の会議全体（最終タイムスタンプ ${lastTs}）をカバーしています。
前半だけでなく会議全体（終盤まで）をカバーするようセクションを設計してください。
セクションは時系列順に7〜10個作成してください。各セクションの timestamp は会議全体に分散させ、終盤のタイムスタンプも必ず含めてください。

出力フォーマット：
{
  "summary": ["基本サマリー（3〜5点の箇条書き）"],
  "sections": [
    { "id": "m1", "title": "セクションタイトル", "timestamp": "00:00", "points": ["要点1", "要点2"] }
  ],
  "decisions": ["意思決定事項1", "意思決定事項2"],
  "nextActions": [
    { "task": "タスク名", "owner": "担当者", "due": "期日" }
  ]
}

会議文字起こし：
${transcript}`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
    })
    const aiData = await aiRes.json()
    const raw = aiData.content?.[0]?.text || ''
    let parsed: any
    try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) }
    catch { return NextResponse.json({ error: 'AI応答をJSONとして解析できませんでした', raw: raw.slice(0, 500) }, { status: 502 }) }

    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    const html = buildHtml(parsed, { title: String(title), date: String(date), participants: String(participants || ''), videoUrl })

    await redis.set(contentKeyFor(id), html)
    const entry = { id, title: String(title), date: String(date), type: 'html', videoUrl: videoUrl || '', createdAt: new Date().toISOString() }
    const existing: any[] = (await redis.get(KEY) as any[]) || []
    await redis.set(KEY, [entry, ...existing].slice(0, 200))

    return NextResponse.json({ success: true, material: entry })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
