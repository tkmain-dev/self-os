# API 仕様書

## 概要

すべての API エンドポイントは `/api` プレフィックスで始まる。
ベース URL: `http://localhost:3001/api`

- Content-Type: `application/json`
- CORS: 全オリジン許可（開発環境）

## エンドポイント一覧

| リソース | ベースパス | ルートファイル |
|---------|-----------|--------------|
| ToDo | `/api/todos` | `server/routes/todos.ts` |
| 日記 | `/api/diary` | `server/routes/diary.ts` |
| スケジュール | `/api/schedules` | `server/routes/schedule.ts` |
| 習慣 | `/api/habits` | `server/routes/habits.ts` |
| 目標 | `/api/goals` | `server/routes/goals.ts` |
| Feature Request | `/api/feature-requests` | `server/routes/featureRequests.ts` |
| ウィッシュアイテム | `/api/wish-items` | `server/routes/wishItems.ts` |

---

## ToDo API (`/api/todos`)

### GET `/api/todos`
全タスクを取得。ソート: `done ASC, created_at DESC`（未完了優先）

**レスポンス**: `200`
```json
[{ "id": 1, "title": "タスク名", "done": 0, "due_date": "2024-01-15", "created_at": "..." }]
```

### POST `/api/todos`
タスクを作成。

**リクエスト**:
```json
{ "title": "タスク名", "due_date": "2024-01-15" }
```
`due_date` はオプション。

**レスポンス**: `201`

### PATCH `/api/todos/:id`
完了状態を更新。

**リクエスト**: `{ "done": 1 }`

### DELETE `/api/todos/:id`
タスクを削除。**レスポンス**: `204`

---

## 日記 API (`/api/diary`)

### GET `/api/diary/:date`
指定日の日記を取得。存在しない場合は `{ date, content: "" }` を返す。

**パラメータ**: `date` — YYYY-MM-DD

**レスポンス**: `200`
```json
{ "id": 1, "date": "2024-01-01", "content": "...", "updated_at": "..." }
```

### PUT `/api/diary/:date`
日記を保存・更新（UPSERT）。

**リクエスト**: `{ "content": "日記の内容（BlockNote JSON）" }`

### GET `/api/diary`
最新30件の日記一覧を取得（プレビュー付き）。

**レスポンス**: `200`
```json
[{ "date": "2024-01-01", "preview": "最初の50文字..." }]
```

---

## スケジュール API (`/api/schedules`)

### GET `/api/schedules`
スケジュールを取得。

**クエリパラメータ**:
- `date` — 特定日のみ取得（YYYY-MM-DD）
- `from` & `to` — 日付範囲で取得

**ソート**: `start_time ASC`（日付指定時）/ `date ASC, start_time ASC`（全件）

**レスポンス**: `200`
```json
[{ "id": 1, "title": "会議", "date": "2024-01-01", "start_time": "10:00", "end_time": "11:00", "memo": "会議室A" }]
```

### POST `/api/schedules`
スケジュールを作成。

**リクエスト**:
```json
{ "title": "会議", "date": "2024-01-01", "start_time": "10:00", "end_time": "11:00", "memo": "会議室A" }
```
`start_time`, `end_time`, `memo` はオプション。

**レスポンス**: `201`

### PUT `/api/schedules/:id`
スケジュールを更新。リクエスト形式は POST と同じ。

### DELETE `/api/schedules/:id`
スケジュールを削除。**レスポンス**: `204`

---

## 習慣 API (`/api/habits`)

### GET `/api/habits`
全習慣を取得。ソート: `created_at ASC`

### POST `/api/habits`
習慣を作成。

**リクエスト**: `{ "name": "運動" }`
**レスポンス**: `201`

### DELETE `/api/habits/:id`
習慣を削除。関連ログも CASCADE 削除。**レスポンス**: `204`

### GET `/api/habits/logs`
習慣ログを取得。

**クエリパラメータ**: `from`, `to`（YYYY-MM-DD）

**レスポンス**: `200`
```json
[{ "id": 1, "habit_id": 1, "date": "2024-01-01" }]
```

### POST `/api/habits/:id/logs`
習慣ログをトグル（存在すれば削除、なければ追加）。

**リクエスト**: `{ "date": "2024-01-01" }`
**レスポンス**: 追加時 `201` / 削除時 `200 { "deleted": true }`

---

## 目標 API (`/api/goals`)

### GET `/api/goals`
全目標を取得（フラット配列、フロントでツリー構築）。

**クエリパラメータ**: `from`, `to` — 日付範囲フィルタ（指定期間に重なる目標を取得）

**ソート**: `sort_order ASC, created_at ASC`

**レスポンス**: `200`
```json
[{
  "id": 1,
  "parent_id": null,
  "title": "プロジェクトA",
  "issue_type": "epic",
  "status": "in_progress",
  "priority": "high",
  "category": "仕事",
  "start_date": "2024-01-01",
  "end_date": "2024-06-30",
  "progress": 50,
  "color": "amber",
  "memo": "メモ",
  "sort_order": 1,
  "created_at": "..."
}]
```

### POST `/api/goals`
目標を作成。`sort_order` は同じ親の中で最大値+1 が自動設定。

**リクエスト**:
```json
{
  "parent_id": null,
  "title": "プロジェクトA",
  "issue_type": "epic",
  "status": "todo",
  "priority": "high",
  "category": "仕事",
  "start_date": "2024-01-01",
  "end_date": "2024-06-30",
  "color": "amber",
  "memo": "メモ"
}
```
`issue_type`, `status`, `priority`, `category`, `color`, `memo` はオプション（デフォルト値あり）。

**レスポンス**: `201`
**副作用**: `parent_id` 指定時、親の期間が自動調整される（`syncParentDates`）

### PATCH `/api/goals/:id`
目標を部分更新。指定しないフィールドは既存値を保持。

**副作用**: 更新後、親の期間が自動調整される

### DELETE `/api/goals/:id`
目標を削除。子目標も CASCADE 削除。

**副作用**: 削除後、親の期間が自動調整される

**レスポンス**: `204`

### POST `/api/goals/reorder`
並び順を一括更新。

**リクエスト**:
```json
{ "orders": [{ "id": 1, "sort_order": 0 }, { "id": 2, "sort_order": 1 }] }
```
トランザクションで一括更新。

---

## Feature Request API (`/api/feature-requests`)

### GET `/api/feature-requests`
全 Feature Request を取得。ソート: `sort_order ASC, created_at ASC`

**レスポンス**: `200`
```json
[{
  "id": 1,
  "title": "ダークモード",
  "description": "詳細仕様...",
  "status": "pending",
  "sort_order": 1,
  "created_at": "..."
}]
```

### POST `/api/feature-requests`
Feature Request を作成。

**リクエスト**:
```json
{ "title": "ダークモード", "description": "詳細仕様..." }
```
**レスポンス**: `201`

### PATCH `/api/feature-requests/:id`
Feature Request を更新。`title`, `description`, `status` を部分更新可能。

**ステータス値**: `pending` / `in_progress` / `done` / `rejected`

### DELETE `/api/feature-requests/:id`
Feature Request を削除。**レスポンス**: `204`

### POST `/api/feature-requests/reorder`
並び順を一括更新。

**リクエスト**: `{ "orders": [{ "id": 1, "sort_order": 0 }] }`

---

## ウィッシュアイテム API (`/api/wish-items`)

### GET `/api/wish-items`
アイテムを取得。

**クエリパラメータ**: `type` — `wish` または `bucket`（必須）

**ソート**: 同一タイプ内で `sort_order ASC, created_at ASC`

**レスポンス**: `200`
```json
[{
  "id": 1,
  "list_type": "wish",
  "title": "MacBook Pro",
  "price": 300000,
  "url": "https://...",
  "deadline": "2024-12-31",
  "memo": "メモ",
  "done": 0,
  "sort_order": 1,
  "created_at": "..."
}]
```

### POST `/api/wish-items`
アイテムを作成。

**リクエスト**:
```json
{
  "list_type": "wish",
  "title": "MacBook Pro",
  "price": 300000,
  "url": "https://...",
  "deadline": "2024-12-31",
  "memo": "メモ"
}
```
`price`, `url`, `deadline`, `memo` はオプション。

**レスポンス**: `201`

### PATCH `/api/wish-items/:id`
アイテムを部分更新。`done` フラグの変更もここで行う。

### DELETE `/api/wish-items/:id`
アイテムを削除。**レスポンス**: `204`

### POST `/api/wish-items/reorder`
並び順を一括更新。

**リクエスト**: `{ "orders": [{ "id": 1, "sort_order": 0 }] }`

---

## エラーハンドリング

一般的な HTTP ステータスコードを使用:

| ステータス | 意味 |
|-----------|------|
| `200 OK` | 成功 |
| `201 Created` | リソース作成成功 |
| `204 No Content` | 削除成功 |
| `404 Not Found` | リソースが見つからない（goals の PATCH/DELETE で使用） |
