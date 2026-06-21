#!/usr/bin/env bash
# 最新のマーケ・ブリーフを「SAMURAI脳」に流し込む（＝今のフォーカスを更新する）。
# ブリーフ生成セッション(CC)の最後にこれを実行すれば、脳の「📌今のフォーカス」が自動で最新化される。
#
#   使い方:  bash scripts/push-brief.sh [ブリーフファイル]
#   省略時:  output/marketing-brief-*.md の最新を自動で使う
#   フォーカス文はサーバー側でAIが自動生成する（手で書かなくてよい）。
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:-$(ls -t output/marketing-brief-*.md 2>/dev/null | head -1)}"
[ -z "${FILE:-}" ] && { echo "❌ brief file not found (output/marketing-brief-*.md)"; exit 1; }
[ -f "$FILE" ] || { echo "❌ not a file: $FILE"; exit 1; }

URL="${BRAIN_URL:-https://samurai-dashboard.vercel.app}/api/brain-brief"
echo "→ pushing $FILE to $URL"

python3 -c "import json; print(json.dumps({'text': open('$FILE', encoding='utf-8').read()}))" \
  | curl -s -X POST "$URL" -H 'Content-Type: application/json' --data @- \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ updated. focus:\n'+(d.get('focus') or '(なし)')) if d.get('ok') else print('❌ '+str(d))"
