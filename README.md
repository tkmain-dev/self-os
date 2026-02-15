# 手帳（Techo）アプリケーション

個人の日々のスケジュール、習慣、日記、目標を管理するためのデジタル手帳アプリケーションです。

## 機能

- 📅 **デイリーページ**: スケジュールタイムライン、日記、習慣トラッカー
- 🎯 **目標管理**: ガントチャート形式での目標管理と進捗追跡

## 技術スタック

- **フロントエンド**: React 19 + TypeScript + Vite + Tailwind CSS
- **バックエンド**: Express.js + TypeScript
- **データベース**: SQLite (better-sqlite3)

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動（クライアント + サーバー）
npm run dev

# クライアントのみ起動
npm run dev:client

# サーバーのみ起動
npm run dev:server

# ビルド
npm run build

# プレビュー
npm run preview
```

## ドキュメント

詳細なシステム構成ドキュメントは [`docs/`](./docs/) ディレクトリを参照してください。

- 📐 [システムアーキテクチャ](./docs/architecture.md)
- 🗄️ [データベース設計](./docs/database.md)
- 🎨 [フロントエンド構成](./docs/frontend.md)
- 🔌 [API仕様書](./docs/api.md)

## ライセンス

このプロジェクトはプライベートプロジェクトです。
