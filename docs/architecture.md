# システムアーキテクチャ

## システム概要

「手帳（Techo）」は、個人の日々のスケジュール、習慣、日記、目標を管理するためのデジタル手帳アプリケーションです。

## システム構成図

```mermaid
graph TB
    subgraph "クライアント層"
        Browser[Webブラウザ]
        React[React 19 + TypeScript]
        Router[React Router]
        Components[UIコンポーネント]
    end

    subgraph "開発環境"
        Vite[Vite Dev Server<br/>ポート: 5173]
        Proxy[API Proxy<br/>/api → :3001]
    end

    subgraph "サーバー層"
        Express[Express.js Server<br/>ポート: 3001]
        Routes[API Routes]
        CORS[CORS Middleware]
    end

    subgraph "データ層"
        SQLite[(SQLite Database<br/>techo.db)]
        Tables[テーブル群]
    end

    Browser --> React
    React --> Router
    Router --> Components
    Components --> Vite
    Vite --> Proxy
    Proxy --> Express
    Express --> CORS
    CORS --> Routes
    Routes --> SQLite
    SQLite --> Tables

    style Browser fill:#e1f5ff
    style React fill:#e1f5ff
    style Express fill:#fff4e1
    style SQLite fill:#e8f5e9
```

## 技術スタック

### フロントエンド
- **React 19.2.0** - UIフレームワーク
- **TypeScript 5.9.3** - 型安全性
- **Vite 7.3.1** - ビルドツール・開発サーバー
- **React Router 7.13.0** - ルーティング
- **Tailwind CSS 4.1.18** - スタイリング

### バックエンド
- **Express.js 5.2.1** - Webサーバー
- **TypeScript 5.9.3** - 型安全性
- **better-sqlite3 12.6.2** - SQLiteデータベースドライバ
- **CORS 2.8.6** - クロスオリジンリソース共有

### データベース
- **SQLite** - リレーショナルデータベース（ファイルベース）

## ディレクトリ構造

```
techo-app/
├── src/                    # フロントエンドソースコード
│   ├── components/         # Reactコンポーネント
│   ├── hooks/              # カスタムフック
│   ├── App.tsx             # メインアプリケーション
│   └── main.tsx            # エントリーポイント
├── server/                 # バックエンドソースコード
│   ├── routes/             # APIルート定義
│   ├── db.ts               # データベース接続・初期化
│   └── index.ts            # サーバーエントリーポイント
├── data/                   # データベースファイル
│   └── techo.db            # SQLiteデータベース
├── public/                 # 静的ファイル
├── dist/                   # ビルド成果物
└── docs/                   # ドキュメント
```

## 通信フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Browser as ブラウザ
    participant Vite as Vite Dev Server
    participant Express as Express Server
    participant DB as SQLite

    User->>Browser: ページアクセス
    Browser->>Vite: リクエスト (HTML/JS/CSS)
    Vite-->>Browser: レスポンス
    Browser->>Browser: Reactアプリ起動

    User->>Browser: 操作（データ取得/更新）
    Browser->>Vite: APIリクエスト (/api/*)
    Vite->>Express: プロキシ転送
    Express->>DB: SQLクエリ実行
    DB-->>Express: データ
    Express-->>Vite: JSONレスポンス
    Vite-->>Browser: JSONレスポンス
    Browser->>Browser: UI更新
    Browser-->>User: 結果表示
```

## デプロイ構成

```mermaid
graph LR
    subgraph "開発環境"
        Dev[開発モード<br/>npm run dev]
        DevVite[Vite :5173]
        DevExpress[Express :3001]
    end

    subgraph "本番環境"
        Build[ビルド<br/>npm run build]
        Static[静的ファイル<br/>dist/]
        Server[Express Server<br/>:3001]
        DB[(SQLite DB)]
    end

    Dev --> DevVite
    Dev --> DevExpress
    Build --> Static
    Server --> Static
    Server --> DB

    style Dev fill:#e1f5ff
    style Build fill:#fff4e1
    style Server fill:#fff4e1
```
