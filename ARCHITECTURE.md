# ARCHITECTURE — samurai-dashboard

SAMURAI ARCHITECTS × THE MOLTS のマーケティングプロジェクト管理ダッシュボード。
Next.js 16 (App Router) + React 19 / TypeScript / Tailwind v4。データ層は Upstash Redis（REST）。
AI 処理は Anthropic API、外部連携は Google News RSS / YouTube字幕 / Google Sheets(GAS webhook) / Slack Events API。

> ⚠️ このリポジトリの Next.js は破壊的変更を含む特殊バージョン。実装前に `node_modules/next/dist/docs/` の該当ガイドを参照すること（AGENTS.md より）。

---

## ディレクトリツリー（node_modules 等を除く・depth 3）

```
.
├── AGENTS.md                 # プロジェクト指示（CLAUDE.md が @import）
├── CLAUDE.md
├── README.md
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── tsconfig.json
├── package.json
├── public/                   # 静的SVGアイコン (file/globe/next/vercel/window)
└── src/
    ├── proxy.ts              # Basic認証ミドルウェア (/api 以外を保護)
    └── app/
        ├── layout.tsx        # ルートレイアウト
        ├── page.tsx          # 単一ページSPA（全画面をview切替で表示）
        ├── globals.css
        ├── api/              # APIルート群（下記「APIルート」参照）
        │   ├── claude/           ├── kpi/            ├── slack-logs/
        │   ├── competitors/      ├── members/        ├── slack-webhook/
        │   ├── content-expressions/ ├── questions/   ├── sync-ng-list/
        │   ├── content-plans/    ├── scrape/         ├── tasks/
        │   ├── content-writings/ ├── decompose/      ├── trends/
        │   ├── extract-text/     ├── knowledge/      └── youtube-transcript/
        ├── Competitors.tsx       # 競合情報画面
        ├── ContentGen.tsx        # 発信コンテンツ生成（3エージェント）
        ├── Knowledge.tsx         # ナレッジベース
        ├── KpiView.tsx           # KPI編集画面
        ├── MtgImport.tsx         # MTGデータ取り込み
        ├── QuestionsView.tsx     # 質問シート
        ├── SlackLogView.tsx      # コミュニケーションログ
        ├── TaskTracker.tsx       # タスクトラッカー
        ├── TaskModal.tsx         # タスク編集モーダル
        ├── GanttView.tsx         # スケジュール（ガント）
        ├── TrendChart.tsx        # 成約/問い合わせ推移グラフ（仮データ）
        └── TrendsSection.tsx     # 業界トレンドニュース（Competitors内で使用）
```

---

## 1. ページ／ルート（画面）一覧

このアプリは **単一ルート (`/`)** の SPA。`page.tsx` の `view` ステートでセクションを切り替える（サーバ側ページ分割はなし）。各「画面」は左サイドバーのナビ項目に対応する。

| view 値 | 画面名 | 役割（1行説明） |
|---|---|---|
| `home` | ホーム | 案件相談数KGI・主要KPI・推移グラフ・対応待ち/遅延・今週のアクションのサマリ表示 |
| `kpi` | KPI | 施策別KPI数値をクリック編集（`KpiView`） |
| `schedule` | スケジュール | タスクをガントチャートで表示・編集（`GanttView`） |
| `tasks` | タスクトラッカー | 対応待ち/遅延/進行中タスクを優先度別に管理（`TaskTracker`） |
| `questions` | 質問シート | タスク遂行に必要な回答・承認を管理（`QuestionsView`） |
| `settings` | データ連携 | GA4/X/Slack/手動入力の連携設定UI（大半は静的フォームのモック） |
| `members` | メンバー管理 | SAMURAI / THE MOLTS の担当者リスト編集（`page.tsx`内に実装） |
| `slack` | コミュニケーションログ | Slackメッセージ履歴表示＋AI抽出（`SlackLogView`） |
| `mtg-import` | MTGデータ取り込み | 議事録/資料からタスク・質問・ナレッジを自動抽出（`MtgImport`） |
| `content-gen` | 発信コンテンツ生成 | 企画→編集→執筆の3エージェントで発信コンテンツ生成（`ContentGen`） |
| `knowledge` | ナレッジベース | 資料を蓄積・分解管理。コンテンツ生成時の参照元（`Knowledge`） |
| `competitors` | 競合情報 | 競合サービスをURL/YouTube/テキストから登録・分析（`Competitors`） |

ルート: `layout.tsx`（フォント・metadata）/ `page.tsx`（全画面）。

---

## 2. 主要コンポーネント構成

`page.tsx`（`Dashboard`）が全体の状態を保持し、各セクションへ props を流すコンテナ。共通の state: `tasks` / `kpi` / `members` / `modalTask` / `view`。

| コンポーネント | 概要 | 受け取る主な props |
|---|---|---|
| `page.tsx` (Dashboard) | ルートSPA。view切替・tasks/kpi/membersのfetch保存を統括 | — |
| `KpiView` | KPI数値のインライン編集。`TrendChart`(非compact)を内包 | — |
| `TrendChart` | recharts折れ線。成約数・問い合わせ数推移（**仮データ**、APIなし） | `compact?` |
| `GanttView` | スケジュールのガント表示・期間ドラッグ編集 | `tasks, members, onTasksChange, onEditTask` |
| `TaskTracker` | タスク一覧（状態別） | `tasks, members, onStatusChange, onOpenModal` |
| `TaskModal` | タスク新規/編集/削除モーダル | `task, members, onSave, onDelete, onClose` |
| `QuestionsView` | 質問の追加・回答・ステータス管理 | `members` |
| `SlackLogView` | Slackログ表示＋競合/ナレッジAI抽出 | `members` |
| `MtgImport` | ファイル/テキスト取込→AIでタスク・質問・ナレッジ抽出 | — |
| `ContentGen` | 3エージェント（企画/編集/執筆）でコンテンツ生成・Sheets同期 | — |
| `Knowledge` | ナレッジの登録・AI分解(decompose)・編集・削除 | — |
| `Competitors` | 競合登録（scrape/YouTube/AI解析）。`TrendsSection`を内包 | — |
| `TrendsSection` | Google Newsトレンド取得・ナレッジ保存 | — |

UIスタイルは `page.tsx` 内のインライン `<style>`（CSS変数）と `globals.css` に集約。

---

## 3. APIルート一覧（`src/app/api/*`）

| ルート | メソッド | 役割 | 外部サービス / Redisキー |
|---|---|---|---|
| `/api/tasks` | GET / POST | タスク配列の取得・保存（全置換） | Redis `samurai:tasks` |
| `/api/kpi` | GET / POST | KPI値オブジェクトの取得・保存 | Redis `samurai:kpi` |
| `/api/members` | GET / POST | 担当者リスト取得・保存（デフォルト値あり） | Redis `samurai:members` |
| `/api/questions` | GET / POST | 質問シートの取得・保存（全置換） | Redis `samurai:questions` |
| `/api/knowledge` | GET / POST / DELETE / PATCH | ナレッジの一覧/追加(先頭・最大200)/ID削除/ID更新 | Redis `samurai:knowledge` |
| `/api/decompose` | POST | テキストを4万字チャンクに分割し、カテゴリ別にAI抽出してナレッジへ追記 | **Anthropic** (`claude-haiku-4-5-20251001`) + Redis `samurai:knowledge` |
| `/api/competitors` | GET / POST / DELETE / PATCH | 競合の一覧/追加(同名はマージ・最大200)/ID削除/ID更新 | Redis `samurai:competitors` |
| `/api/content-plans` | GET / POST | コンテンツ企画の取得・追加（最大50） | Redis `samurai:content-plans` |
| `/api/content-expressions` | GET / POST / DELETE | 訴求表現の取得・追加(最大100)・全削除 | Redis `samurai:content-expressions` |
| `/api/content-writings` | GET / POST | 執筆原稿の取得・追加（最大100） | Redis `samurai:content-writings` |
| `/api/sync-ng-list` | POST | 最新セッションの訴求表現を整形しGAS webhookへ送信（Sheets同期） | **GAS Webhook** + Redis `samurai:content-expressions` |
| `/api/claude` | POST | Anthropic Messages API への汎用プロキシ（リクエストbodyを素通し） | **Anthropic API** |
| `/api/extract-text` | POST | アップロードPDF→テキスト抽出、md/txtはUTF-8で返却 | `pdf-parse`（外部呼び出しなし） |
| `/api/scrape` | POST | 任意URLをfetchしHTMLタグ除去、先頭3000字を返却 | 任意の外部URL |
| `/api/youtube-transcript` | POST | YouTube URLから字幕テキスト取得 | **YouTube字幕**（`youtube-transcript`） |
| `/api/trends` | GET | 建築/建設キーワードでGoogle News RSSを取得（各3件） | **Google News RSS** |
| `/api/slack-logs` | GET | Slackメッセージ履歴の取得 | Redis `samurai:slack-logs` |
| `/api/slack-webhook` | POST | Slack Events受信（URL検証＋message保存・最大500） | **Slack Events API** + Redis `samurai:slack-logs` |

補足:
- `/api/claude` はクライアントから直接Anthropic bodyを組み立てて呼ぶ汎用窓口。各コンポーネントは `model` を指定（UI側はほぼ `claude-haiku-4-5-20251001`、`MtgImport` のみ `claude-sonnet-4-20250514`）。サーバ側 `/api/decompose` も Haiku を直接叩く。
- `/api/scrape` はYouTube/競合の本文取得や簡易検索の取得手段として `Competitors` から複数回利用される。

---

## 4. データ層

### 4-1. Upstash Redis（`@upstash/redis` REST クライアント）

接続は各ルートで `new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN })`。
すべて **単一キーに値（配列 or オブジェクト）を丸ごと set/get** する設計（ハッシュやリスト型は未使用）。

| キー | 型 | 保存内容 | 書込上限 |
|---|---|---|---|
| `samurai:tasks` | Task[] | タスク（施策/名称/期間/担当/状態 等） | 全置換 |
| `samurai:kpi` | object | KPI数値（CVR・インプレッション・KGI等） | 全置換 |
| `samurai:members` | `{samurai:[], molts:[]}` | チーム別担当者名 | 全置換 |
| `samurai:questions` | object[] | 質問シート（内容/状態/優先度/紐付タスク） | 全置換 |
| `samurai:knowledge` | object[] | ナレッジ（title/content/label/source/createdAt） | 先頭追加・最大200 |
| `samurai:competitors` | object[] | 競合（名称/要約/特徴/弱み/additionalInfo履歴） | 先頭追加・最大200・同名マージ |
| `samurai:content-plans` | object[] | コンテンツ企画 | 先頭追加・最大50 |
| `samurai:content-expressions` | object[] | 訴求表現（sessionId/items/theme/target等） | 先頭追加・最大100 |
| `samurai:content-writings` | object[] | 執筆原稿 | 先頭追加・最大100 |
| `samurai:slack-logs` | object[] | Slackメッセージ（id/channel/user/text/ts） | 先頭追加・最大500 |

### 4-2. Google Sheets / GAS Webhook 連携

- `/api/sync-ng-list` が `samurai:content-expressions` の**最新 `sessionId` のエントリのみ**（無ければ先頭3件）を `{expression, judgment, theme, target, reason, direction, date}` に整形。
- `GAS_WEBHOOK_URL`（Google Apps Script の公開webhook）へ `{ items, append }` を POST → スプレッドシートへ追記/上書き。
- 呼び出し元は `ContentGen`（訴求表現テーブルからSheets同期ボタン）。

### 4-3. 外部API

| サービス | 用途 | 呼び出し箇所 |
|---|---|---|
| **Anthropic API** (`api.anthropic.com/v1/messages`) | コンテンツ生成・抽出・分解・競合解析 | `/api/claude`（汎用プロキシ）、`/api/decompose`（サーバ直） |
| **Google News RSS** (`news.google.com/rss/search`) | 建築/建設業界のトレンドニュース取得 | `/api/trends` → `TrendsSection` |
| **YouTube字幕** (`youtube-transcript`) | 競合動画の字幕テキスト化 | `/api/youtube-transcript` → `Competitors` |
| **Slack Events API** | メッセージ受信（webhook） | `/api/slack-webhook` |
| **GAS Webhook** | Sheetsへ訴求表現を書き出し | `/api/sync-ng-list` |
| 任意Webサイト | 競合ページ本文の取得 | `/api/scrape` |

---

## 5. 機能間のデータフロー（読み書きマップ）

**ホーム / タスク / スケジュール（共通の `tasks`）**
- `page.tsx` が起動時に `GET /api/kpi`(`samurai:kpi`)・`GET /api/tasks`(`samurai:tasks`)・`GET /api/members`(`samurai:members`) を読み込み。
- 状態変更（`TaskTracker`/`GanttView`/`TaskModal`/ホームのチェック）→ `POST /api/tasks` で全置換保存。
- `members` 編集 → `POST /api/members`。

**KPI**
- `KpiView` が `GET /api/kpi` 読込 → インライン編集 → `POST /api/kpi` 保存。ホームの数値も同キーを共有。
- 成約/問い合わせ推移（`TrendChart`）は**APIを使わず仮データ**。

**質問シート**
- `QuestionsView` ⇄ `samurai:questions`（GET/POST）。`MtgImport` も追記する（下記）。

**MTGデータ取り込み（`MtgImport`）** — 取込の起点
1. ファイルは `POST /api/extract-text`（PDF/txt/md→テキスト）。
2. テキストを `POST /api/claude`（Sonnet）でタスク・質問・ナレッジに抽出。
3. 結果を `GET→POST /api/tasks`(`samurai:tasks`)、`GET→POST /api/questions`(`samurai:questions`)、`POST /api/knowledge`(`samurai:knowledge`) へ反映。

**ナレッジベース（`Knowledge`）**
- `GET /api/knowledge` 表示。ファイル取込は `extract-text`→`/api/claude`抽出→`POST /api/knowledge`。
- 長文は `POST /api/decompose`（チャンク分割＋Haiku抽出）でカテゴリ別に `samurai:knowledge` へ追記。
- 編集/削除は `PATCH/DELETE /api/knowledge`。

**発信コンテンツ生成（`ContentGen`）** — 3エージェント
1. `GET /api/knowledge` を参照素材として読込。
2. 企画→編集→執筆を `POST /api/claude`（Haiku）で順次生成。
3. 企画 `POST /api/content-plans`、訴求表現 `POST /api/content-expressions`、原稿 `POST /api/content-writings` に保存。
4. 「Sheets同期」で `POST /api/sync-ng-list` → `samurai:content-expressions` 最新セッション → GAS → スプレッドシート。

**競合情報（`Competitors`）**
- `GET /api/competitors` 表示。登録元は `POST /api/scrape`（URL本文）/ `POST /api/youtube-transcript`（字幕）/ 直接テキスト。
- 取得本文を `POST /api/claude`（Haiku）で解析 → `POST /api/competitors`（同名はサーバ側でマージ）。編集/削除は `PATCH/DELETE`。
- 内包する `TrendsSection` が `GET /api/trends`（Google News）→ 記事を `POST /api/knowledge` に保存可能。

**コミュニケーションログ（`SlackLogView`）**
- 外部Slack → `POST /api/slack-webhook` → `samurai:slack-logs`（最大500・先頭追加）。
- 画面は `GET /api/slack-logs` 表示。`POST /api/claude`（Haiku）で
  - 競合言及を抽出 → `POST /api/competitors`
  - ナレッジを2段階抽出 → `POST /api/knowledge`

**認証（横断）**
- `src/proxy.ts` が Basic認証ミドルウェア。`matcher: ['/((?!api).*)']` により **`/api/*` 以外**の画面アクセスを保護（API自体は素通し）。

---

## 6. 使用している環境変数（名前のみ）

> 値・トークン・キーは記載しない。

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ANTHROPIC_API_KEY`
- `GAS_WEBHOOK_URL`
- `BASIC_AUTH_USER`
- `BASIC_AUTH_PASS`
