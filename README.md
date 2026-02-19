# 手帳 (Techo App)

個人向けの統合型プロダクティビティツール。日々のスケジュール・習慣・目標・ウィッシュリストを一元管理するダークモダンテーマの Web アプリケーション。

## 機能一覧

### デイリー (`/daily`)
1日の予定・習慣・日記を一画面で確認・管理する。

- **タイムライン**: 6:00〜24:00 の時間軸にスケジュールを表示。現在時刻インジケーター付き
- **習慣トラッカー**: 直近7日間のチェックマトリクス。習慣の追加・削除・打刻
- **日記**: BlockNote リッチテキストエディタによるその日の記録。5秒デバウンスの自動保存

### カレンダー (`/calendar`)
月・週・日の3ビューで予定と目標を俯瞰する。

- **月ビュー**: 各日セルにスケジュールと目標をバンド表示
- **週ビュー**: 時間軸グリッドにスケジュール配置、目標はバンドで横断表示
- **日ビュー**: 1日の詳細タイムラインと目標バンド
- **予定作成**: 日付クリックからモーダルで新規スケジュール登録

### 目標管理 (`/goals`)
WBS（Work Breakdown Structure）ベースのガントチャートで目標を階層管理する。

- **階層構造**: Epic > Story > Task > Subtask の4階層
- **ガントチャート**: 1ヶ月/3ヶ月/6ヶ月/1年の表示レンジ切替
- **ドラッグ操作**: バーのリサイズ・移動で期間変更、行のドラッグで並替・親子関係変更
- **自動期間伝播**: 子の期間変更が親に自動反映
- **進捗管理**: ステータス（todo/in_progress/done）、優先度、カラーカスタマイズ

### ウィッシュリスト (`/wishlist`)
「買いたいもの」と「やりたいこと」の2タブで管理する。タブごとにテーマカラーが切り替わる。

- **買いたいもの（Wish）**: 商品名・価格・URL・期限・メモ。合計金額表示。amber テーマ
- **やりたいこと（Bucket）**: タイトル・参考URL・期限・メモ。teal-violet テーマ
- **チケット化**: やりたいことリストから目標管理の Story チケットを作成（Epic選択または新規作成）
- **ドラッグ並替**: 優先順位をドラッグ＆ドロップで変更
- **日記パネル**: 編集中に右側に日記を表示

### 管理ページ（歯車ボタン）
サイドバー左下の歯車ボタンからモーダルで開く。

- **Feature Requests**: 開発要望のCRUD管理。ステータス（pending/in_progress/done/rejected）
- **完了済み分離表示**: 完了・却下の項目は左パネルに分離表示
- **コミットメッセージ記録**: 完了済みの項目に対応する git コミットを記録・表示
- **ドラッグ並替**: 優先順位をドラッグ＆ドロップで変更
- **日記パネル**: 編集中に右側に日記を表示（行単位でチェックボックス＋グレーアウト）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19, TypeScript, Tailwind CSS 4, Vite 7 |
| エディタ | BlockNote (Notion風リッチテキスト) |
| ルーティング | React Router v7 |
| バックエンド | Express 5, TypeScript, tsx |
| データベース | SQLite (better-sqlite3, WAL モード) |
| 同時実行 | concurrently (client + server) |

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# 開発サーバー起動（フロント + バックエンド同時起動）
npm run dev
```

- フロントエンド: `http://localhost:5173`
- バックエンド API: `http://localhost:3001`
- Vite のプロキシ設定により、フロントからの `/api` リクエストはバックエンドに自動転送

### その他のコマンド

```bash
npm run dev:client   # フロントエンドのみ起動
npm run dev:server   # バックエンドのみ起動
npm run build        # プロダクションビルド
npm run lint         # ESLint 実行
npm run preview      # ビルド結果プレビュー
```

## プロジェクト構成

```
techo-app/
├── server/                   # バックエンド
│   ├── index.ts              # Express サーバー (port 3001)
│   ├── db.ts                 # SQLite 接続 & スキーマ定義
│   └── routes/               # API ルートハンドラ
│       ├── todos.ts
│       ├── diary.ts
│       ├── schedule.ts
│       ├── habits.ts
│       ├── goals.ts
│       ├── featureRequests.ts
│       └── wishItems.ts
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
│       ├── DatePicker.tsx     # 日付ピッカーコンポーネント
│       ├── DiaryChecklist.tsx # 日記チェックリスト（グレーアウト）
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
└── data/                     # SQLite データベース (gitignore)
```

## ドキュメント

詳細なドキュメントは [`docs/`](./docs/) ディレクトリを参照してください。

- [システムアーキテクチャ](./docs/architecture.md)
- [データベース設計](./docs/database.md)
- [フロントエンド構成](./docs/frontend.md)
- [API 仕様書](./docs/api.md)

## ライセンス

このプロジェクトはプライベートプロジェクトです。
