'use client'
import Researcher from '../Researcher'

// リサーチャーを独立URL（/researcher）として提供する自己完結ページ。
// 必要なCSS変数・ユーティリティクラスのみ内包し、他ページへ影響を出さない。
export default function ResearcherPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        :root {
          --bg: #f4f4f2; --paper: #ffffff;
          --b1: rgba(0,0,0,0.08); --b2: rgba(0,0,0,0.05);
          --ink: #0f0f0f; --ink2: #3f3f3f; --muted: #8c8c8c;
          --green: #16a34a; --gbg: #f0fdf4;
          --red: #dc2626; --rbg: #fef2f2;
          --orange: #c2410c; --obg: #fff7ed;
          --yellow: #b45309; --ybg: #fffbeb;
          --r: 6px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter','Noto Sans JP',sans-serif; background: var(--bg); color: var(--ink); font-size: 12px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
        .r-hd { height: 48px; background: var(--paper); border-bottom: 0.5px solid var(--b1); display: flex; align-items: center; justify-content: space-between; padding: 0 18px; position: sticky; top: 0; z-index: 100; }
        .r-hd-l { display: flex; align-items: center; gap: 10px; }
        .r-logo { font-size: 12px; font-weight: 600; letter-spacing: -0.01em; }
        .r-div { width: 1px; height: 14px; background: var(--b1); }
        .r-proj { font-size: 12px; color: var(--muted); }
        .r-back { font-size: 11px; color: var(--muted); text-decoration: none; border: 0.5px solid var(--b1); border-radius: var(--r); padding: 4px 10px; }
        .r-back:hover { background: var(--bg); color: var(--ink); }
        .r-pg { padding: 20px 22px 48px; max-width: 1160px; margin: 0 auto; }
        .pg-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 2px; }
        .pg-sub { font-size: 11px; color: var(--muted); margin-bottom: 18px; }
        .stat-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; margin-bottom: 12px; }
        .sc { background: var(--paper); border: 0.5px solid var(--b1); border-radius: var(--r); padding: 12px 14px; }
        .sc-ey { font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
        .sc-v { font-size: 32px; font-weight: 700; letter-spacing: -0.04em; line-height: 1; }
        .sc-sub { font-size: 11px; color: var(--muted); margin-top: 5px; display: flex; align-items: center; gap: 5px; }
      `}</style>

      <header className="r-hd">
        <div className="r-hd-l">
          <span className="r-logo">SAMURAI × THE MOLTS</span>
          <span className="r-div" />
          <span className="r-proj">リサーチャー</span>
        </div>
        <a href="/" className="r-back">← ダッシュボード</a>
      </header>

      <main className="r-pg">
        <Researcher />
      </main>
    </>
  )
}
