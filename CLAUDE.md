# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業する際のルールとコンテキストを提供します。

## ルール

### 言語

ユーザーとの会話は**日本語**で行うこと。

### 開発ワークフロー（厳守）

1. 実装 → ビルド確認 → **開発環境で動作確認を報告**
2. **ユーザーの許可を待ってから** git commit + push（勝手にpushしない）
3. パイプライン完了後、ユーザーが画面確認
4. 問題なければ完了フロー（PATCH FR）

- Branch: main direct push（feature branchは使わない）
- Deploy: push to main → GitHub Actions auto-deploy → Cloud Run

### 開発の進め方（重要）

- 要件や仕様に不明点・曖昧な点がある場合は、推測で進めずユーザーに確認する
- 大きな実装は小さなステップに分割し、各ステップごとにユーザーに確認を取る
- 技術選定やアーキテクチャの判断が必要な場面では、選択肢と推奨案を提示してユーザーと合意してから進める

### コミットメッセージ

- Conventional Commits形式（feat:, fix:, refactor:, docs:, test:, chore:）
- 日本語で記述（例: `feat: ダイアリーチェックリスト実装`）

### Git Push 時のドキュメント更新

ユーザーから Git Push の依頼を受けた際は、コミット・プッシュの**前に**必ず以下を実施すること:

1. `README.md` の内容が現在のコードと一致しているか確認し、乖離があれば更新する
2. `docs/` 配下の各ドキュメントを確認し、乖離があれば更新する
   - `docs/architecture.md` — システムアーキテクチャ
   - `docs/database.md` — データベース設計
   - `docs/frontend.md` — フロントエンド構成
   - `docs/api.md` — API 仕様書
   - `docs/README.md` — ドキュメントインデックス

### コード修正時のドキュメント確認

コード修正を加えた場合は、`docs/` 配下や `README.md` の内容を精査し、修正が必要であれば合わせて修正する。

### Feature Request ステータス管理

- Feature Request のステータスはユーザーの承認なしに変更しない。
- **`in_progress`のFRのみ開発対象** — 他ステータスのFRには着手しない。
- ただし、Feature Request 経由でユーザーが依頼した機能を実装し、ユーザーが承認（「完璧」「完了」「いいです」など肯定的な確認）した場合は、後述の「完了フロー」を実行すること。

### Feature Request 完了フロー（git push 時）

ユーザーから git push の依頼を受けた際、Feature Request に紐づく実装が含まれる場合は以下の順序で処理する:

1. `README.md` / `docs/` を精査・更新する
2. `git add` → `git commit` → `git push` を実行する
3. コミットハッシュ（短縮形）とコミットメッセージを取得する
4. 対象の Feature Request に対して以下を API PATCH で記録する:
   - `status`: `"done"`
   - `commit_message`: `"<hash> <subject>"` 形式（例: `abc1234 feat: ダイアリーチェックリスト実装`）
   - FR API URL: `https://techo-app-qci2z4yx2q-an.a.run.app/api/feature-requests/:id`（Cloud URL を使用、localhost ではない）
   - Cloud への PATCH にはクッキー認証が必要（先にログインしてクッキーを取得する）

## プロジェクト概要

個人向け統合型プロダクティビティツール「手帳（Techo）」。

- **フロントエンド**: React 19 + TypeScript + Tailwind CSS 4 + Vite 7
- **バックエンド**: Express 5 + better-sqlite3 (SQLite, journal_mode=DELETE)
- **開発サーバー**: `npm run dev`（フロント + バックエンド同時起動、port 3001）
- **GitHub**: `tkmain-dev/self-os` (main branch)

## よく使うコマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # ビルド
npm run lint         # ESLint
```

## Cloud / GCP

- GCP Project: `techo-app-f3ece185`
- App URL: **https://techo-app-qci2z4yx2q-an.a.run.app** (Cloud Run direct, FR#54でLB廃止)
- 旧 LB IP: `35.227.242.58` (FR#54で削除)
- AR repo: `asia-northeast1-docker.pkg.dev/techo-app-f3ece185/techo-repo`
- Cloud Run: `techo-app` (asia-northeast1), ingress=INTERNAL_LOAD_BALANCER
- GCS bucket: `techo-app-f3ece185-sqlite` (SQLite at /data/techo.db)
- Terraform: `infra/terraform/`（tfstate はローカル管理、コミットしない）
- GitHub Actions SA: `techo-github-actions@techo-app-f3ece185.iam.gserviceaccount.com`
- DB: ローカルと Cloud は独立（ローカルは開発専用、同期不要）

## セキュリティ

- パスワード認証: `AUTH_PASSWORD` 環境変数（GitHub Secret → Cloud Run env）
- セッション方式: httpOnly cookie, 30日有効期限, `auth_sessions` テーブル
- `crypto.timingSafeEqual` による定数時間パスワード比較
- helmet.js セキュリティヘッダー、express-rate-limit (100 req/15min)、CORS 制限
- Auth ミドルウェア: `/api/*` を保護（`/api/auth/*` は除外）
- `AUTH_PASSWORD` 未設定時 → 認証無効（ローカル開発用）
- エンドポイント: `POST /api/auth/login`, `GET /api/auth/check`, `POST /api/auth/logout`
- フロントエンド: 全 fetch に `credentials: 'include'`、401 → ログイン画面にリロード

## DB テーブル一覧

todos, diary, schedules, habits, habit_logs, goals, feature_requests, monthly_goals, wish_items, weekly_goals, routines, budget_entries, auth_sessions, budget_categories, budget_subcategories, budget_plans, budget_income, budget_actuals

## 主要ファイル

- `server/db.ts` — DB 初期化 + マイグレーション + 予算シードデータ
- `server/index.ts` — Express アプリ + セキュリティミドルウェア + 静的ファイル配信
- `server/routes/auth.ts` — 認証（login/check/logout）
- `server/routes/budgetManagement.ts` — 予算管理 API（計画, 収入, CSV取込, 実績）
- `src/App.tsx` — ルーティング + 認証状態管理
- `src/components/LoginPage.tsx` — ログイン UI
- `src/components/Layout.tsx` — ナビゲーションサイドバー
- `src/components/BudgetPage.tsx` — タブ付き予算ページ（決済管理, 予算設定, CSV取込, 予実比較）
- `src/components/budget/` — 予算タブコンポーネント群
- `infra/terraform/` — Terraform IaC
- `.github/workflows/deploy.yml` — CI/CD（AUTH_PASSWORD シークレットを渡す）

## チーム体制

Claudeは全ロールを担当するが、作業内容に応じて「今どのロールとして作業しているか」を意識し、各ロールの責務を果たすこと。

- **プロジェクトリード**: タスク分割、進捗の可視化、ユーザーへの確認事項の整理
- **アーキテクト**: 技術選定、設計判断時は必ず根拠を示す
- **フロントエンド開発**: UI/UX実装
- **バックエンド開発**: データ層、SQLite設計
- **QA**: 各ステップで動作確認を行い、壊れていないことを保証する

## 組織的開発体制（複数FR並行時はマスト）

複数FRを並行開発する際は以下の体制で進めること:

- **PdM**: 全チームを統括、優先順位管理、FR間の依存関係を調整
- **各FRにチームリーダー**: 設計・実装・レビューを主導
- **QA**: 全FR横断で結合テスト、FR間の干渉・デグレがないことを保証
- 実装完了後、QAが結合テストを実施してからユーザーに報告する

## 既知の問題・注意点

- Express 5: SPA フォールバックには `app.use(handler)` を使う（`app.get('*', handler)` は path-to-regexp の破壊的変更で動かない）
- GCSFuse + SQLite: `journal_mode=DELETE` を使用（WAL は GCSFuse と非互換）
- GitHub Actions CI/CD: リポジトリ Variables に `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_AR_REPO`, `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT` の設定が必要
- Cloud Run: Terraform で `deletion_protection=true` がデフォルト — destroy 前に `terraform state rm` が必要
