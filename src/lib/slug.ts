// 日付（YYYY-MM-DD）+ タイトルから読めるURLスラッグを生成する。
// タイトルはひらがな・カタカナ・漢字を除き、英数字とハイフンのみにする。

export function slugify(input: string): string {
  return String(input || '')
    .toLowerCase()
    // ひらがな・カタカナ・漢字（CJK統合漢字＋拡張A）・全角記号を除去
    .replace(/[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿＀-￯]/g, '')
    // 残った英数字以外をハイフンに
    .replace(/[^a-z0-9]+/g, '-')
    // 連続・先頭末尾のハイフンを整理
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// date(YYYY-MM-DD) + title からベーススラッグを作る。manual 指定があればそれを優先。
export function buildSlug(date: string, title: string, manual?: string): string {
  if (manual && manual.trim()) {
    const m = slugify(manual)
    if (m) return m
  }
  const dateDigits = String(date || '').replace(/[^0-9]/g, '') // 2026-06-10 -> 20260610
  const titleSlug = slugify(title)
  const base = [dateDigits, titleSlug].filter(Boolean).join('-')
  return base || dateDigits || 'gijiroku'
}

// 既存スラッグ集合と衝突する場合は -2, -3 ... を付与してユニーク化。
export function uniqueSlug(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
