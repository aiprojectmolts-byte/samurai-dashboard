import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: 'https://magnetic-trout-42426.upstash.io',
  token: 'AaW6AAIgcDFkMmU1MjYzNjRjNmQ0ZDFlYmQ2ZmFlZTc5Yjc5OGNlOQ',
})

const WRITE = process.argv.includes('--write')
const LABEL = '6/10定例'
const targetNames = [
  'アーキテクツLP改修提案書作成・実装',
  'レンダリーLP改修・散在ページの整理',
  'リサーチャーチャンネル作成・運用ルール設定',
  '加藤利基氏ライター人格のAIプロンプト定義・試作',
  'ユーザー事例記事・コラムのAIプロンプト型化',
  '相談フォーム最適化（アーキテクツ・レンダリー別）',
  'メール＋手紙併用の顧客接触シナリオ設計',
  'マーケティングKPI管理ダッシュボード構築',
  '戸田建設・三井住友建設セミナー記事化',
  '加藤氏人格定義サンプルの本人確認と調整',
]

const tasks = (await redis.get('samurai:tasks')) || []
const list = Array.isArray(tasks) ? tasks : []

let changes = 0
const updated = list.map(t => {
  if (t && targetNames.includes(t.name)) {
    const already = t.label === LABEL
    console.log(`${already ? '（変更なし）' : '✓'} ${t.name}  label: ${t.label ?? '(なし)'} → ${LABEL}`)
    if (!already) changes++
    return { ...t, label: LABEL }
  }
  return t
})

const matched = targetNames.filter(n => list.some(t => t?.name === n))
const missing = targetNames.filter(n => !matched.includes(n))
console.log(`\n対象 ${targetNames.length}件 / マッチ ${matched.length}件 / 実変更 ${changes}件`)
if (missing.length) { console.log('⚠ 未マッチのタスク名:'); missing.forEach(n => console.log('  -', n)) }

if (!WRITE) {
  console.log('\n※ ドライランです。Redisにはまだ書き込んでいません。')
  process.exit(0)
}

await redis.set('samurai:tasks', updated)
const verify = (await redis.get('samurai:tasks')) || []
const ok = targetNames.every(n => verify.find(t => t?.name === n)?.label === LABEL)
console.log('\n書き込み完了。')
console.log(`「${LABEL}」が設定されたタスク数: ${verify.filter(t => t?.label === LABEL).length}`)
console.log('検証（対象10件すべてに設定済み）:', ok ? 'OK' : 'NG')
