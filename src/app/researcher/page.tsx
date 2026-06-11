'use client'
// リサーチャーの独立URL(/researcher)。本体ダッシュボードを初期viewをリサーチャーにして表示。
// 発信コンテンツ生成(/content-gen)と同じ方式に統一（サイドバー維持・直リンク/リロード対応）。
import Dashboard from '../page'

export default function ResearcherPage() {
  return <Dashboard />
}
