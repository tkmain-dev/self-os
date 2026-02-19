# システムアーキテクチャ

## システム概要

「手帳（Techo）」は、個人の日々のスケジュール、習慣、日記、目標、ウィッシュリストを管理するためのデジタル手帳アプリケーションです。

## システム構成図

```
┌─────────────────┐      proxy /api      ┌──────────────────┐
│   Vite (5173)   │ ──────────────────▶  │  Express (3001)  │
│   React SPA     │                      │  REST API        │
│   Tailwind CSS  │                      │  better-sqlite3  │
└─────────────────┘                      └──────┬───────────┘
                                                │
                                         ┌──────▼───────────┐
                                         │  SQLite (WAL)    │
                                         │  data/techo.db   │
                                         └──────────────────┘
```

- **フロントエンド**: Vite 7 で React 19 + TypeScript をビルド・配信（ポート 5173）
- **バックエンド**: Express 5 で REST API を提供（ポート 3001）
- **DB**: SQLite をファイルベースで利用。WAL モードで高速読み書き
- **プロキシ**: 開発時は Vite の proxy 設定で `/api` を Express へ転送

## 技術スタック

### フロントエンド
- **React 19** — UI フレームワーク
- **TypeScript 5.9** — 型安全性
- **Vite 7** — ビルドツール・開発サーバー（HMR 対応）
- **React Router v7** — クライアントサイドルーティング
- **Tailwind CSS 4** — ユーティリティファーストスタイリング
- **BlockNote** — Notion 風リッチテキストエディタ（日記機能）
- **Mantine** — BlockNote 用 UI コンポーネント

### バックエンド
- **Express 5** — Web サーバー
- **TypeScript** — 型安全性（tsx で直接実行）
- **better-sqlite3** — 同期的 SQLite ドライバ
- **cors** — クロスオリジンリソース共有

### データベース
- **SQLite** — リレーショナルデータベース（ファイルベース）
- **WAL モード** — 書き込み性能向上
- **外部キー制約** — 有効化（データ整合性保証）

## 開発サーバー

`npm run dev` で `concurrently` により以下が同時起動する:

1. `vite` — フロントエンド開発サーバー（HMR 対応）
2. `tsx server/index.ts` — バックエンドサーバー（TypeScript を直接実行）

## ディレクトリ構造

```
techo-app/
├── server/                   # バックエンド
│   ├── index.ts              # Express サーバー (port 3001)
│   ├── db.ts                 # SQLite 接続 & スキーマ定義
│   └── routes/               # API ルートハンドラ
│       ├── todos.ts          # ToDo CRUD
│       ├── diary.ts          # 日記 CRUD
│       ├── schedule.ts       # スケジュール CRUD
│       ├── habits.ts         # 習慣 + ログ CRUD
│       ├── goals.ts          # 目標 CRUD + 並替 + 期間伝播
│       ├── featureRequests.ts # Feature Request CRUD + 並替
│       └── wishItems.ts      # ウィッシュアイテム CRUD + 並替
├── src/                      # フロントエンド
│   ├── main.tsx              # React エントリポイント
│   ├── App.tsx               # ルーティング定義
│   ├── index.css             # グローバルスタイル & ダークテーマ
│   ├── hooks/
│   │   └── useApi.ts         # API 通信フック
│   └── components/
│       ├── Layout.tsx         # サイドバー + ページレイアウト
│       ├── DailyPage.tsx      # デイリーページ
│       ├── Diary.tsx          # BlockNote 日記エディタ
│       ├── GoalGantt.tsx      # WBS ガントチャート
│       ├── HabitTracker.tsx   # 習慣トラッカー
│       ├── Schedule.tsx       # スケジュール表示
│       ├── TodoList.tsx       # ToDo リスト
│       ├── WishListPage.tsx   # ウィッシュ / バケットリスト
│       ├── admin/
│       │   └── AdminModal.tsx # 管理モーダル (Feature Requests)
│       └── calendar/          # カレンダー機能
│           ├── CalendarPage.tsx
│           ├── CalendarHeader.tsx
│           ├── CalendarMonthView.tsx
│           ├── CalendarWeekView.tsx
│           ├── CalendarDayView.tsx
│           ├── CalendarDayCell.tsx
│           ├── CalendarTimeGrid.tsx
│           ├── CalendarEventItem.tsx
│           ├── CalendarGoalItem.tsx
│           ├── CalendarFormModal.tsx
│           ├── calendarTypes.ts
│           └── calendarUtils.ts
├── data/                     # SQLite データベース (gitignore)
├── docs/                     # ドキュメント
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## ルーティング

| パス | コンポーネント | 説明 |
|------|---------------|------|
| `/` | → `/daily` にリダイレクト | |
| `/daily` | `DailyPage` | デイリーページ |
| `/calendar` | `CalendarPage` | カレンダー（月/週/日） |
| `/goals` | `GoalGantt` | 目標管理ガントチャート |
| `/wishlist` | `WishListPage` | ウィッシュ / バケットリスト |

管理モーダル（`AdminModal`）はサイドバーの歯車ボタンから開き、Feature Request を管理する。

## レイアウト

```
┌──────────┬──────────────────────────────┐
│          │                              │
│ サイドバー │        メインコンテンツ         │
│  (w-52)  │                              │
│          │                              │
│ デイリー   │    各ページのコンポーネント      │
│ カレンダー │                              │
│ 目標管理  │                              │
│ ウィッシュ │                              │
│          │                              │
│──────────│                              │
│ ⚙ 管理   │                              │
└──────────┴──────────────────────────────┘
```

## API 通信

`src/hooks/useApi.ts` で統一的な API 通信を提供:

| 関数 | 用途 |
|------|------|
| `useApi<T>(url)` | データ取得フック（loading, data, refetch） |
| `apiPost<T>(url, body)` | POST リクエスト |
| `apiPatch<T>(url, body)` | PATCH リクエスト |
| `apiPut<T>(url, body)` | PUT リクエスト |
| `apiDelete(url)` | DELETE リクエスト |

## スタイリング

- **Tailwind CSS 4**: ユーティリティファーストでスタイリング
- **ダークモダンテーマ**: `src/index.css` で CSS 変数によるデザインシステムを定義
- **カラーパレット**: 背景 `#0e0e12` / `#16161e`、テキスト `#e4e4ec`、アクセント `amber-500`、ボーダー `#2a2a3a`
- **BlockNote カスタマイズ**: エディタのダークテーマを CSS 変数でオーバーライド
- **タブ別テーマ**: ウィッシュリストではタブごとに amber / teal-violet のテーマが切り替わる

## 共通パターン

### ドラッグ＆ドロップ並替

goals, featureRequests, wishItems で共通のパターン:

1. HTML5 Drag and Drop API を使用（外部ライブラリ不要）
2. `POST /{resource}/reorder` で `{ orders: [{ id, sort_order }] }` を送信
3. サーバー側はトランザクションで一括更新

### 目標の期間自動伝播

`goals.ts` の `syncParentDates` 関数:

- 子目標の期間変更時、親の `start_date` を子の最小値、`end_date` を子の最大値に自動更新
- 再帰的にルートまで伝播
