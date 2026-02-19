# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業する際のルールとコンテキストを提供します。

## ルール

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

Feature Request のステータスはユーザーの承認なしに変更しない。ユーザーが「完了」と明言するまで `done` にしないこと。

## プロジェクト概要

個人向け統合型プロダクティビティツール「手帳（Techo）」。

- **フロントエンド**: React 19 + TypeScript + Tailwind CSS 4 + Vite 7
- **バックエンド**: Express 5 + better-sqlite3
- **開発サーバー**: `npm run dev`（フロント + バックエンド同時起動）

## よく使うコマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # ビルド
npm run lint         # ESLint
```
