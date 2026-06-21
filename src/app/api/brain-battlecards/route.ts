import { NextResponse } from 'next/server'
import { BATTLECARDS } from '@/lib/battlecards'

// 競合バトルカード（画面の⚔️競合タブ用）。
export async function GET() {
  return NextResponse.json({ cards: BATTLECARDS })
}
