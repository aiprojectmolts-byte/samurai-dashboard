import { NextResponse } from 'next/server'

// 画面で選択した「わからん語」を、その場で超平易に解説する軽量エンドポイント。
const MODEL = 'claude-haiku-4-5-20251001'
const SYSTEM = `あなたはSAMURAI ARCHITECTS（建築×AIのスタートアップ。プロダクト=Rendery[AI建築パース]/knock knock AI[空室のバーチャルステージング]/VISIOAL[企画段階の空間ビジュアル]/カスタム[図面のBIM化等の受託]。顧客=中小工務店・不動産・建設）の用語解説係です。
渡された語句を、建築もマーケも初心者の人に向けて、次のルールで説明してください。
- まず1〜2文で超平易に（中学生にも分かる言葉、必要ならたとえ話）。
- その語がSAMURAI/建築・不動産業界に関係するなら、最後に「→ 自社的には〜」を一言だけ添える（無関係なら省く）。
- 全体で短く（3〜4文以内）。装飾は控えめ。
- 知らない・固有名詞で確証がない場合は、でっち上げず「確認できていない（要確認）」と正直に言う。`

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  try {
    const { term } = await request.json()
    if (!term || !String(term).trim()) return NextResponse.json({ error: '語句が空です' }, { status: 400 })
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 350, system: SYSTEM,
        messages: [{ role: 'user', content: `次の語句を解説して：「${String(term).slice(0, 120)}」` }],
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: `Anthropic error ${res.status}` }, { status: 500 })
    return NextResponse.json({ text: data.content?.[0]?.text || '（取得できませんでした）' })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
