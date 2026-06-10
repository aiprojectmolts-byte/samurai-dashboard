'use client'
import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

interface Material {
  id: string
  title: string
  date: string
  type: 'html' | 'video' | 'link'
  url?: string
  htmlUrl?: string
  videoUrl?: string
  createdAt: string
}

type UploadStage = 'idle' | 'uploading-video' | 'uploading-html' | 'saving' | 'done'

const typeLabel: Record<Material['type'], string> = { html: '📄 HTML', video: '🎬 動画', link: '🔗 リンク' }
const stageMsg: Record<UploadStage, string> = {
  idle: '', done: '',
  'uploading-video': '動画をアップロード中...',
  'uploading-html': '議事録HTMLをアップロード中...',
  'saving': '保存中...',
}

// XMLHttpRequest で /api/upload に送信し、進捗(0-100)を onProgress に通知。完了で Blob URL を返す。
function xhrUpload(file: File | Blob, filename: string, onProgress: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload')
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (data.url) resolve(data.url)
          else reject(new Error(data.error || 'URLが返りませんでした'))
        } catch { reject(new Error('レスポンス解析エラー')) }
      } else {
        reject(new Error(`アップロード失敗 (${xhr.status})${xhr.responseText ? '：' + xhr.responseText.slice(0, 200) : ''}`))
      }
    }
    xhr.onerror = () => reject(new Error('ネットワークエラー'))
    const fd = new FormData()
    fd.append('file', file, filename)
    xhr.send(fd)
  })
}

export default function Materials() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<UploadStage>('idle')
  const [pct, setPct] = useState(0)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [type, setType] = useState<Material['type']>('html')
  const [url, setUrl] = useState('')
  const [htmlFile, setHtmlFile] = useState<File | null>(null)
  const [videoSource, setVideoSource] = useState<'file' | 'url'>('file')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrlInput, setVideoUrlInput] = useState('')
  const htmlRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/materials')
      const data = await res.json()
      if (Array.isArray(data)) setMaterials(data)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const resetForm = () => {
    setTitle(''); setDate(new Date().toISOString().slice(0, 10)); setType('html')
    setUrl(''); setHtmlFile(null); setVideoFile(null); setVideoUrlInput(''); setVideoSource('file')
    setError(''); setStage('idle'); setPct(0)
  }

  const onHtml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setHtmlFile(f)
    if (f && !title) setTitle(f.name.replace(/\.html?$/i, ''))
  }

  const add = async () => {
    if (!title.trim() || !date) { setError('タイトルと日付を入力してください'); return }
    if (type === 'html' && !htmlFile) { setError('HTMLファイルを選択してください'); return }
    if ((type === 'video' || type === 'link') && !url.trim()) { setError('URLを入力してください'); return }
    setBusy(true); setError(''); setPct(0)
    try {
      let payload: any = { title: title.trim(), date, type }

      if (type === 'html') {
        // ① 動画URL（手動入力 or ファイルアップロード）を確定
        let videoUrl = ''
        if (videoSource === 'url') {
          videoUrl = videoUrlInput.trim()
        } else if (videoFile) {
          setStage('uploading-video'); setPct(0)
          videoUrl = await xhrUpload(videoFile, videoFile.name, setPct)
        }
        // ② HTMLを読み込み、動画srcを videoUrl に置換
        let html = await (htmlFile as File).text()
        if (videoUrl) {
          html = html.replace(/((?:src|href)\s*=\s*)(["'])[^"']*\.(?:mp4|webm|mov|m4v|ogg)\2/gi, `$1$2${videoUrl}$2`)
        }
        // ③ 置換済みHTMLを Blob へアップロード
        setStage('uploading-html'); setPct(0)
        const cid = Date.now().toString() + Math.random().toString(36).slice(2)
        const htmlBlob = new Blob([html], { type: 'text/html' })
        const htmlUrl = await xhrUpload(htmlBlob, `${cid}.html`, setPct)
        // ④ /api/materials にURL・メタデータのみ（JSON）
        payload = { ...payload, htmlUrl, videoUrl }
      } else {
        payload = { ...payload, url: url.trim() }
      }

      setStage('saving')
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.error('[materials] save failed:', res.status, errText)
        throw new Error(`保存失敗 (${res.status})${errText ? '：' + errText.slice(0, 300) : ''}`)
      }
      resetForm()
      setShowForm(false)
      await load()
    } catch (e) {
      console.error('[materials] add error:', e)
      setError('資料の追加に失敗しました：' + String(e))
    }
    setBusy(false); setStage('idle'); setPct(0)
  }

  const open = (m: Material) => {
    const href = m.type === 'html' ? `/api/materials/${m.id}` : (m.url || '')
    if (href) window.open(href, '_blank', 'noopener,noreferrer')
  }

  const remove = async (id: string) => {
    if (!window.confirm('この資料を削除しますか？')) return
    try {
      await fetch('/api/materials', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      await load()
    } catch {}
  }

  const showBar = stage === 'uploading-video' || stage === 'uploading-html'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="pg-title">資料</div>
        <button onClick={() => { resetForm(); setShowForm(true) }} style={{ padding: '5px 14px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>+ 資料を追加</button>
      </div>
      <div className="pg-sub">議事録（HTML）・動画・参考リンクなどの資料を管理する</div>

      {loading && <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>読み込み中...</div>}
      {!loading && materials.length === 0 && <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 12 }}>資料がありません。「+ 資料を追加」から登録してください。</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
        {materials.map(m => (
          <div key={m.id} style={{ background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div onClick={() => open(m)} style={{ cursor: 'pointer', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{m.date}</span>
                <span style={{ fontSize: 9, background: 'var(--bg)', border: '0.5px solid var(--b1)', padding: '1px 6px', borderRadius: 10, color: 'var(--ink2)' }}>{typeLabel[m.type]}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{m.title}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => open(m)} style={{ flex: 1, fontSize: 11, padding: '4px 10px', border: '0.5px solid var(--b1)', borderRadius: 4, background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>開く ↗</button>
              <button onClick={() => remove(m.id)} title="削除" style={{ fontSize: 12, padding: '4px 8px', border: '0.5px solid var(--b1)', borderRadius: 4, background: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={overlay} onClick={() => !busy && setShowForm(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>資料を追加</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={lbl}>タイトル<input value={title} onChange={e => setTitle(e.target.value)} style={inp} placeholder="例：2026-06-10_自社マーケ定例_議事録" /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={lbl}>日付<input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></label>
                <label style={lbl}>
                  タイプ
                  <select value={type} onChange={e => setType(e.target.value as Material['type'])} style={inp}>
                    <option value="html">HTML（ファイル）</option>
                    <option value="video">動画（URL）</option>
                    <option value="link">リンク（URL）</option>
                  </select>
                </label>
              </div>
              {type === 'html' ? (
                <>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>① HTMLファイル</div>
                    <div onClick={() => htmlRef.current?.click()} style={dropzone}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{htmlFile ? `✓ ${htmlFile.name}` : 'クリックしてHTMLファイルを選択'}</div>
                    </div>
                    <input ref={htmlRef} type="file" accept=".html,.htm,text/html" style={{ display: 'none' }} onChange={onHtml} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>② 動画（任意・HTML内の動画srcを置換）</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      {([['file', '動画ファイルを選択'], ['url', '動画URLを入力']] as const).map(([val, label]) => (
                        <button key={val} onClick={() => setVideoSource(val)}
                          style={{ padding: '4px 12px', borderRadius: 20, border: '0.5px solid var(--b1)', background: videoSource === val ? 'var(--ink)' : 'none', color: videoSource === val ? '#fff' : 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {videoSource === 'file' ? (
                      <>
                        <div onClick={() => videoRef.current?.click()} style={dropzone}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{videoFile ? `✓ ${videoFile.name}` : 'クリックして動画ファイルを選択'}</div>
                        </div>
                        <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => setVideoFile(e.target.files?.[0] || null)} />
                      </>
                    ) : (
                      <input value={videoUrlInput} onChange={e => setVideoUrlInput(e.target.value)} style={inp} placeholder="YouTube・Google Drive等の共有リンク" />
                    )}
                  </div>
                </>
              ) : (
                <label style={lbl}>URL<input value={url} onChange={e => setUrl(e.target.value)} style={inp} placeholder="https://..." /></label>
              )}

              {(stage !== 'idle' || error) && (
                <div>
                  {stage !== 'idle' && <div style={{ fontSize: 11, color: 'var(--ink2)', marginBottom: 4 }}>{stageMsg[stage]}{showBar ? ` ${pct}%` : ''}</div>}
                  {showBar && (
                    <div style={{ background: 'var(--b1)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: pct + '%', height: '100%', background: 'var(--green)', borderRadius: 3, transition: 'width 0.2s' }} />
                    </div>
                  )}
                  {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{error}</div>}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} disabled={busy} style={{ padding: '6px 14px', background: 'none', border: '0.5px solid var(--b1)', color: 'var(--muted)', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>キャンセル</button>
              <button onClick={add} disabled={busy} style={{ padding: '6px 16px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.5 : 1 }}>{busy ? '処理中...' : 'アップロード'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modal: CSSProperties = { background: 'var(--paper)', border: '0.5px solid var(--b1)', borderRadius: 'var(--r)', padding: 24, width: 460, fontFamily: 'inherit', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: '90vh', overflowY: 'auto' }
const lbl: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted)', fontFamily: 'inherit' }
const inp: CSSProperties = { border: '0.5px solid var(--b1)', borderRadius: 4, padding: '7px 9px', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', width: '100%', boxSizing: 'border-box' }
const dropzone: CSSProperties = { border: '1px dashed var(--b1)', borderRadius: 'var(--r)', padding: 16, textAlign: 'center', cursor: 'pointer', background: 'var(--bg)' }
