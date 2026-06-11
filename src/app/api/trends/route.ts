import { NextResponse } from 'next/server'
import { fetchTrendsGrouped } from '@/lib/sources'

export async function GET() {
  const results = await fetchTrendsGrouped(3)
  return NextResponse.json({ results })
}
