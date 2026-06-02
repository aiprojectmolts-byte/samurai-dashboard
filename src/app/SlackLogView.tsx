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

  useEffect(() => {
    fetch('/api/slack-logs').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setLogs(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const formatDate = (ts: string) => {
    const d = new Date(parseFloat(ts) * 1000)
    return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="cw">
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
