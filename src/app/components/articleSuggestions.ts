// 記事確認の「提案モード」中核ロジック（UIから分離）。
// 原文は不変（モデルA）。提案は別レコードで蓄積し、承認済みのみを表示・書き出し時に合成する。
// フェーズ1は noteBody（ブロック単位）が対象。target を見て noteTitle/xPosts にも拡張できる形にしてある。
import { diffChars } from 'diff'

export type SuggestionTarget = 'noteBody' | 'xPosts' | 'noteTitle'
export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'superseded'

export interface ArticleSuggestion {
  id: string
  articleId: string
  target: SuggestionTarget
  blockIndex?: number   // noteBody: 空行分割ブロックの番号
  postIndex?: number    // xPosts: 投稿番号
  original: string      // アンカー時点のブロック原文（ズレ検出用）
  proposed: string      // 提案後テキスト（作成後は不変）
  status: SuggestionStatus
  proposer: string      // 提案者の実名
  approver?: string     // 承認/却下した人の実名（提案者と別人でも成立）
  note?: string         // 却下理由など
  createdAt: string
  decidedAt?: string
}

// 記事本文のスナップショット。ContentGen の Content と互換。
export interface ArticleContent {
  xPosts: string[]
  noteTitle: string
  noteOutline: string
  noteBody: string
}

// id 採番（ブラウザ/サーバ双方で動く）。
export const newSuggestionId = (prefix = 'sug'): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

// noteBody を空行区切りのブロックに分割。提案時・適用時で必ず同じ関数を使い index を一致させる。
export const splitBlocks = (noteBody: string): string[] =>
  (noteBody || '').replace(/\r\n/g, '\n').split(/\n{2,}/).map(b => b.trim()).filter(b => b.length > 0)

export const joinBlocks = (blocks: string[]): string => blocks.join('\n\n')

// ブロック識別キー（同一ブロックに承認済み提案は最大1件、を判定するための単位）。
export const blockKey = (s: Pick<ArticleSuggestion, 'target' | 'blockIndex' | 'postIndex'>): string =>
  s.target === 'xPosts' ? `xPosts:${s.postIndex ?? 0}`
  : s.target === 'noteBody' ? `noteBody:${s.blockIndex ?? 0}`
  : 'noteTitle'

// 承認済みの提案だけを原文に合成して新しい Content を返す（原文は破壊しない）。
export const applyApproved = (content: ArticleContent, suggestions: ArticleSuggestion[]): ArticleContent => {
  const out: ArticleContent = { ...content }
  const approved = (suggestions || []).filter(s => s.status === 'approved')

  const titleS = approved.find(s => s.target === 'noteTitle')
  if (titleS) out.noteTitle = titleS.proposed

  const bodyByBlock = new Map<number, string>()
  for (const s of approved) {
    if (s.target === 'noteBody' && typeof s.blockIndex === 'number') bodyByBlock.set(s.blockIndex, s.proposed)
  }
  if (bodyByBlock.size > 0) {
    const blocks = splitBlocks(content.noteBody)
    out.noteBody = joinBlocks(blocks.map((b, i) => (bodyByBlock.has(i) ? (bodyByBlock.get(i) as string) : b)))
  }

  const posts = [...(content.xPosts || [])]
  let postsChanged = false
  for (const s of approved) {
    if (s.target === 'xPosts' && typeof s.postIndex === 'number' && s.postIndex < posts.length) {
      posts[s.postIndex] = s.proposed
      postsChanged = true
    }
  }
  if (postsChanged) out.xPosts = posts

  return out
}

export interface DiffSeg { type: 'equal' | 'del' | 'ins'; value: string }

// 文字単位の差分（jsdiff diffChars）。連続する変更は jsdiff が自動的にまとめて返す。
export const charDiff = (original: string, proposed: string): DiffSeg[] =>
  diffChars(original || '', proposed || '').map(p => ({
    type: p.added ? 'ins' : p.removed ? 'del' : 'equal',
    value: p.value,
  }))

// 1ブロックにつき承認済みは最大1件。複数あれば decidedAt が最新のものを残し、他は superseded に降格。
export const enforceSingleApproved = (suggestions: ArticleSuggestion[]): ArticleSuggestion[] => {
  const latestByKey = new Map<string, ArticleSuggestion>()
  for (const s of suggestions) {
    if (s.status !== 'approved') continue
    const k = blockKey(s)
    const cur = latestByKey.get(k)
    if (!cur || (s.decidedAt || '') >= (cur.decidedAt || '')) latestByKey.set(k, s)
  }
  return suggestions.map(s => {
    if (s.status === 'approved' && latestByKey.get(blockKey(s))?.id !== s.id) {
      return { ...s, status: 'superseded' as const }
    }
    return s
  })
}
