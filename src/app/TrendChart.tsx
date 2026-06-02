'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const monthlyData = [
  { month: '24/10', rendery: 2, knock: 1, visioal: 0, custom: 1, inquiry: 8 },
  { month: '24/11', rendery: 3, knock: 2, visioal: 1, custom: 0, inquiry: 12 },
  { month: '24/12', rendery: 2, knock: 1, visioal: 2, custom: 1, inquiry: 10 },
  { month: '25/1',  rendery: 4, knock: 2, visioal: 1, custom: 2, inquiry: 15 },
  { month: '25/2',  rendery: 3, knock: 3, visioal: 2, custom: 1, inquiry: 14 },
  { month: '25/3',  rendery: 5, knock: 2, visioal: 3, custom: 2, inquiry: 18 },
  { month: '25/4',  rendery: 4, knock: 4, visioal: 2, custom: 3, inquiry: 20 },
  { month: '25/5',  rendery: 6, knock: 3, visioal: 4, custom: 2, inquiry: 22 },
  { month: '25/6',  rendery: 5, knock: 5, visioal: 3, custom: 3, inquiry: 24 },
]

interface Props {
  compact?: boolean
}

export default function TrendChart({ compact = false }: Props) {
  const data = compact ? monthlyData.slice(-4) : monthlyData

  return (
    <div>
      {!compact && <div className="sh">推移グラフ <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>※仮データ</span></div>}
      {compact && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>直近4ヶ月の推移 <span style={{ fontSize: 10, fontWeight: 400 }}>※仮データ</span></div>}

      <div className="cw" style={{ marginBottom: 12 }}>
        <div className="ih">成約数（プロダクト別）</div>
        <div style={{ padding: '16px 8px' }}>
          <ResponsiveContainer width="100%" height={compact ? 160 : 220}>
            <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--b1)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'inherit', background: 'var(--paper)', border: '0.5px solid var(--b1)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="rendery" name="Rendery" stroke="var(--ink)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="knock" name="knock knock AI" stroke="var(--green)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="visioal" name="VISIOAL" stroke="var(--yellow)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="custom" name="カスタム" stroke="var(--orange)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!compact && (
        <div className="cw" style={{ marginBottom: 12 }}>
          <div className="ih">問い合わせ数（月次）</div>
          <div style={{ padding: '16px 8px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--b1)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'inherit', background: 'var(--paper)', border: '0.5px solid var(--b1)' }} />
                <Line type="monotone" dataKey="inquiry" name="問い合わせ数" stroke="var(--ink)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
