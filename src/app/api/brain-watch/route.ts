import { NextResponse } from 'next/server'
import { WATCH } from '@/lib/watch'

// キャッチアップの「👤 ウォッチ中（業界を動かす人・メディア）」を画面に返す（検証済みリスト）。
export async function GET() {
  return NextResponse.json({ watch: WATCH })
}
