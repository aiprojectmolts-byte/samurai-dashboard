'use client'

import { useState, useEffect } from 'react'

interface KpiData {
  visioalCvr: number
  renderyCvr: number
  knockCvr: number
  jireyCvr: number
  xImpression: number
  xProfileClick: number
  noteViews: number
  referralCount: number
  referralInquiry: number
  referralDeal: number
  inquiryRendery: number
  inquiryKnock: number
  inquiryVisioal: number
  inquiryCustom: number
  srcSearch: number
  srcX: number
  srcReferral: number
  srcDirect: number
}

const defaultKpi: KpiData = {
  visioalCvr: 3.2, renderyCvr: 1.8, knockCvr: 2.1, jireyCvr: 5.4,
  xImpression: 18.4, xProfileClick: 342, noteViews: 4820,
  referralCount: 3, referralInquiry: 1, referralDeal: 0,
  inquiryRendery: 4, inquiryKnock: 5, inquiryVisioal: 2, inquiryCustom: 1,
  srcSearch: 5, srcX: 3, srcReferral: 2, srcDirect: 2,
}

interface Props {
  onSave?: () => void
}

export default function KpiView({ onSave }: Props) {
  const [kpi, setKpi] = useState<KpiData>(defaultKpi)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/kpi')
      .then(r => r.json())
      .then(data => { if (data && Object.keys(data).length > 0) setKpi(data) })
      .catch(() => {})
  }, [])

  const saveKpi = async (updated: KpiData) => {
    setSaving(true)
    try {
      await fetch('/api/kpi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
      onSave?.()
    } catch {}
    setSaving(false)
  }

  const handleChange = (key: keyof KpiData, val: string) => {
    const updated = { ...kpi, [key]: parseFloat(val) || 0 }
    setKpi(updated)
    saveKpi(updated)
  }

  const EditableVal = ({ k, suffix = '' }: { k: keyof KpiData, suffix?: string }) => (
    editing === k
      ? <input
          autoFocus
          type="number"
          defaultValue={kpi[k] as number}
          onBlur={(e) => { handleChange(k, e.target.value); setEditing(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { handleChange(k, (e.target as HTMLInputElement).value); setEditing(null) } }}
          style={{ width: 72, fontSize: 18, fontWeight: 700, border: '0.5px solid var(--b1)', borderRadius: 4, padding: '2px 6px', fontFamily: 'inherit', background: 'var(--bg)' }}
        />
      : <span className="kv" onClick={() => setEditing(k)} title="クリックで編集" style={{ cursor: 'pointer' }}>
          {kpi[k]}{suffix}
        </span>
  )

  const totalInquiry = kpi.inquiryRendery + kpi.inquiryKnock + kpi.inquiryVisioal + kpi.inquiryCustom
  const totalSrc = kpi.srcSearch + kpi.srcX + kpi.srcReferral + kpi.srcDirect

  const pct = (n: number, total: number) => total > 0 ? Math.round(n / total * 100) : 0

  return (
    <div>
      <style>{`
        .kpi3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 10px; }
        .kcat { background: var(--paper); border: 0.5px solid var(--b1); border-radius: var(--r); overflow: hidden; }
        .kch { padding: 8px 12px; background: #fafaf9; border-bottom: 0.5px solid var(--b1); display: flex; align-items: center; justify-content: space-between; }
        .kch h3 { font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink2); }
        .ttag { font-size: 9px; font-weight: 500; padding: 2px 6px; border-radius: 4px; }
        .tt-g { background: var(--gbg); color: var(--green); }
        .tt-m { background: #f0f0ef; color: var(--muted); border: 0.5px solid var(--b1); }
        .tt-x { background: #eff6ff; color: #1d4ed8; }
        .kr { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 0.5px solid var(--b2); }
        .kr:last-child { border-bottom: none; }
        .kr:hover { background: #fafaf9; }
        .kn { font-size: 12px; color: var(--ink); }
        .ksub { font-size: 10px; color: var(--muted); display: block; margin-top: 1px; }
        .kr-r { display: flex; align-items: center; gap: 7px; }
        .kv { font-size: 20px; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; line-height: 1; }
        .mb { width: 44px; }
        .mb-bg { background: #ebebea; border-radius: 2px; height: 3px; overflow: hidden; }
        .mb-fill { height: 100%; border-radius: 2px; background: var(--ink); }
        .edit-hint { font-size: 9px; color: var(--muted); margin-top: 2px; }
        .save-indicator { font-size: 10px; color: var(--muted); margin-bottom: 12px; }
      `}</style>

      <div className="pg-title">KPI</div>
      <div className="pg-sub">施策別の成果・影響度指標 — 数値をクリックして編集できます</div>

      {saving && <div className="save-indicator">保存中...</div>}

      <div className="sh" style={{ marginTop: 0 }}>指標カテゴリ</div>
      <div className="kpi3">
        {/* CVR */}
        <div className="kcat">
          <div className="kch"><h3>CVR — LP→問い合わせ</h3><span className="ttag tt-g">GA4</span></div>
          <div className="kr">
            <div className="kn">VISIOAL LP<span className="ksub">初版公開2週目</span></div>
            <div className="kr-r"><EditableVal k="visioalCvr" suffix="%" /><span className="chip cg">+0.8%</span></div>
          </div>
          <div className="kr">
            <div className="kn">Rendery LP<span className="ksub">改修後</span></div>
            <div className="kr-r"><EditableVal k="renderyCvr" suffix="%" /><span className="chip cg">+0.4%</span><div className="mb"><div className="mb-bg"><div className="mb-fill" style={{ width: `${kpi.renderyCvr / 5 * 100}%` }}></div></div></div></div>
          </div>
          <div className="kr">
            <div className="kn">knock knock AI LP<span className="ksub">改修後</span></div>
            <div className="kr-r"><EditableVal k="knockCvr" suffix="%" /><span className="chip cn">±0</span><div className="mb"><div className="mb-bg"><div className="mb-fill" style={{ width: `${kpi.knockCvr / 5 * 100}%` }}></div></div></div></div>
          </div>
          <div className="kr">
            <div className="kn">事例ページ→問い合わせ<span className="ksub">1本目公開後</span></div>
            <div className="kr-r"><EditableVal k="jireyCvr" suffix="%" /><span className="chip cg">+5.4%</span></div>
          </div>
        </div>

        {/* インプレッション */}
        <div className="kcat">
          <div className="kch"><h3>インプレッション — CEO発信</h3><span className="ttag tt-x">X / note</span></div>
          <div className="kr">
            <div className="kn">X インプレッション<span className="ksub">週次累計（K）</span></div>
            <div className="kr-r"><EditableVal k="xImpression" />K<span className="chip cg">+2.1K</span></div>
          </div>
          <div className="kr">
            <div className="kn">X プロフィールクリック<span className="ksub">週次</span></div>
            <div className="kr-r"><EditableVal k="xProfileClick" /><span className="chip cg">+48</span></div>
          </div>
          <div className="kr">
            <div className="kn">note 閲覧数<span className="ksub">累計</span></div>
            <div className="kr-r"><EditableVal k="noteViews" /><span className="chip cr">−180</span></div>
          </div>
          <div className="kr">
            <div className="kn">LinkedIn 閲覧数<span className="ksub">8月整備後</span></div>
            <div className="kr-r"><span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 13 }}>—</span><span className="chip cn">8月〜</span></div>
          </div>
        </div>

        {/* リファラル */}
        <div className="kcat">
          <div className="kch"><h3>リファラル — VISIOAL</h3><span className="ttag tt-m">手動入力</span></div>
          <div className="kr">
            <div className="kn">声がけ数<span className="ksub">累計</span></div>
            <div className="kr-r"><EditableVal k="referralCount" /><span className="chip cg">目標達成</span><div className="mb"><div className="mb-bg"><div className="mb-fill" style={{ width: '100%' }}></div></div></div></div>
          </div>
          <div className="kr">
            <div className="kn">紹介経由の問い合わせ<span className="ksub">累計</span></div>
            <div className="kr-r"><EditableVal k="referralInquiry" /><span className="chip cg">+1</span></div>
          </div>
          <div className="kr">
            <div className="kn">商談転換数<span className="ksub">累計</span></div>
            <div className="kr-r"><EditableVal k="referralDeal" /><span className="chip cn">—</span></div>
          </div>
        </div>
      </div>

      <div className="sh">問い合わせ内訳</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {/* プロダクト別 */}
        <div className="kcat">
          <div className="kch"><h3>プロダクト別</h3><span className="ttag tt-g">フォーム選択肢</span></div>
          {([
            ['Rendery', '建築パース生成AI', 'inquiryRendery'],
            ['knock knock AI', 'AIホームステージング', 'inquiryKnock'],
            ['VISIOAL', '空間ビジュアライズ', 'inquiryVisioal'],
            ['カスタムソリューション', '受託・BIM等', 'inquiryCustom'],
          ] as [string, string, keyof KpiData][]).map(([label, sub, key]) => (
            <div className="kr" key={key}>
              <div className="kn">{label}<span className="ksub">{sub}</span></div>
              <div className="kr-r">
                <EditableVal k={key} />
                <div style={{ width: 80 }}><div style={{ background: '#ebebea', borderRadius: 2, height: 3, overflow: 'hidden' }}><div style={{ width: `${pct(kpi[key] as number, totalInquiry)}%`, height: '100%', borderRadius: 2, background: 'var(--ink)' }}></div></div></div>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{pct(kpi[key] as number, totalInquiry)}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* 流入元別 */}
        <div className="kcat">
          <div className="kch"><h3>流入元別</h3><span className="ttag tt-g">GA4 + フォーム</span></div>
          {([
            ['検索（オーガニック）', 'Google検索経由', 'srcSearch', 'var(--ink)'],
            ['X（UTM）', 'CEO発信経由', 'srcX', '#b45309'],
            ['紹介（リファラル）', '既存顧客経由', 'srcReferral', 'var(--green)'],
            ['ダイレクト / その他', '直接アクセス等', 'srcDirect', '#b0b8c4'],
          ] as [string, string, keyof KpiData, string][]).map(([label, sub, key, color]) => (
            <div className="kr" key={key}>
              <div className="kn">{label}<span className="ksub">{sub}</span></div>
              <div className="kr-r">
                <EditableVal k={key} />
                <div style={{ width: 80 }}><div style={{ background: '#ebebea', borderRadius: 2, height: 3, overflow: 'hidden' }}><div style={{ width: `${pct(kpi[key] as number, totalSrc)}%`, height: '100%', borderRadius: 2, background: color }}></div></div></div>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{pct(kpi[key] as number, totalSrc)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
