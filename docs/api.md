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
| 月の目標 | `/api/monthly-goals` | `server/routes/monthlyGoals.ts` |
| 家計簿 | `/api/budget` | `server/routes/budget.ts` |
| 予算管理 | `/api/budget-mgmt` | `server/routes/budgetManagement.ts` |

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
[{ "id": 1, "title": "会議", "date": "2024-01-01", "start_time": "10:00", "end_time": "11:00", "memo": "会議室A", "source": null }]
```

### POST `/api/schedules`
スケジュールを作成。

**リクエスト**:
```json
{ "title": "会議", "date": "2024-01-01", "start_time": "10:00", "end_time": "11:00", "memo": "会議室A", "source": null }
```
`start_time`, `end_time`, `memo`, `source` はオプション。習慣D&Dで作成する場合は `source: "habit"` を指定。

**レスポンス**: `201`

### PUT `/api/schedules/:id`
スケジュールを更新（全フィールド）。リクエスト形式は POST と同じ（`source` は除く）。

### PATCH `/api/schedules/:id`
スケジュールを部分更新。指定しないフィールドは既存値を保持。タイムライン上のドラッグ移動・リサイズで使用。

### DELETE `/api/schedules/:id`
スケジュールを削除。**レスポンス**: `204`

---

## 習慣 API (`/api/habits`)

### GET `/api/habits`
全習慣をフラット配列で取得。ソート: `sort_order ASC, created_at ASC`
フロントエンドで `buildHabitTree()` により親子ツリーに変換する。

**レスポンス**: `200`
```json
[{ "id": 1, "parent_id": null, "name": "運動", "sort_order": 1, "duration": 30, "day_of_week": "1,2,3,4,5", "created_at": "..." }]
```

### POST `/api/habits`
習慣を作成。`parent_id` を指定すると子習慣として登録。

**リクエスト**: `{ "name": "ランニング", "parent_id": 1 }`
`parent_id` はオプション（省略でルート習慣）。`sort_order` は同一親グループ内の最大値+1 が自動設定。
**レスポンス**: `201`

### PATCH `/api/habits/:id`
習慣の設定を更新。`name`, `duration`, `day_of_week` を部分更新可能。

**リクエスト**: `{ "name": "新しい習慣名", "duration": 45, "day_of_week": "1,2,3,4,5" }`
**レスポンス**: `200`

### DELETE `/api/habits/:id`
習慣を削除。子習慣・関連ログも CASCADE 削除。**レスポンス**: `204`

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
  "note": null,
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
  "memo": "メモ",
  "note": null
}
```
`issue_type`, `status`, `priority`, `category`, `color`, `memo`, `note` はオプション（デフォルト値あり）。

**レスポンス**: `201`
**副作用**: `parent_id` 指定時、親の期間が自動調整される（`syncParentDates`）

### PATCH `/api/goals/:id`
目標を部分更新。指定しないフィールドは既存値を保持。`note` フィールドに BlockNote JSON を保存可能。

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
  "commit_message": "",
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
Feature Request を更新。`title`, `description`, `status`, `commit_message` を部分更新可能。

**ステータス値**: `pending` / `in_progress` / `done` / `rejected`

**commit_message**: git push 完了後に `<hash> <subject>` 形式で記録（例: `abc1234 feat: 機能名`）

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

## 月の目標 API (`/api/monthly-goals`)

### GET `/api/monthly-goals/:yearMonth`
指定月の目標を取得。存在しない場合は `{ year_month, content: "" }` を返す。

**パラメータ**: `yearMonth` — YYYY-MM（例: `2026-02`）

**レスポンス**: `200`
```json
{ "id": 1, "year_month": "2026-02", "content": "今月の目標テキスト", "updated_at": "..." }
```

### PUT `/api/monthly-goals/:yearMonth`
月の目標を保存・更新（UPSERT）。

**リクエスト**: `{ "content": "今月の目標テキスト" }`
**レスポンス**: `200`（更新後のレコード）

---

## 家計簿 API (`/api/budget`)

月次の支払い管理（追加振込シート）。年月キーで upsert 管理。

### GET `/api/budget`
直近24ヶ月のエントリー一覧を返す。

**レスポンス**: `200`（配列）

### GET `/api/budget/:yearMonth`
指定年月のエントリーを取得。存在しない場合はデフォルト値（全フィールド null）を返す。

**パラメータ**: `yearMonth` — YYYY-MM（例: `2026-01`）

### PUT `/api/budget/:yearMonth`
指定年月のエントリーを保存・更新（UPSERT）。

**リクエスト**:
```json
{
  "au_pay": 25444,
  "mufg_billing": 19339,
  "jcb_billing": 275649,
  "minsin_balance": 170000,
  "mufg_balance": 153659,
  "jcb_skip": 0
}
```
**レスポンス**: `200`（更新後のレコード）

**計算ロジック（フロントエンド側）**:
```
合計請求額 = au_pay + mufg_billing + jcb_billing
総額       = minsin_balance + mufg_balance
要調整額   = 総額 - 合計請求額  ← 負なら不足
JCB実請求  = jcb_billing - jcb_skip
最終請求額 = au_pay + mufg_billing + JCB実請求
余剰金額   = 総額 - 最終請求額
```

---

## 予算管理 API (`/api/budget-mgmt`)

予算の計画・収入・実績を管理する。カテゴリ/サブカテゴリの階層構造で予算を管理。

### GET `/api/budget-mgmt/categories`
全カテゴリとサブカテゴリを取得。

**レスポンス**: `200`
```json
[{
  "id": 1,
  "name": "住宅",
  "type": "fixed",
  "sort_order": 0,
  "subcategories": [
    { "id": 1, "category_id": 1, "name": "家賃", "sort_order": 0 }
  ]
}]
```

### PUT `/api/budget-mgmt/subcategories/:id`
サブカテゴリ名を変更。

**リクエスト**: `{ "name": "新しいサブカテゴリ名" }`
**レスポンス**: `200`

### GET `/api/budget-mgmt/plans/:yearMonth`
指定月の予算計画を取得。

**パラメータ**: `yearMonth` — YYYY-MM

**レスポンス**: `200`
```json
[{
  "id": 1,
  "year_month": "2026-03",
  "subcategory_id": 1,
  "amount": 80000,
  "is_recurring": 1,
  "formula": "[{\"label\":\"家賃\",\"amount\":75000,\"multiplier\":1},{\"label\":\"共益費\",\"amount\":5000,\"multiplier\":1}]",
  "subcategory_name": "家賃",
  "category_id": 1
}]
```

### PUT `/api/budget-mgmt/plans/:yearMonth`
指定月の予算計画を一括保存（UPSERT）。金額が0かつ計算式なしの場合はレコード削除。

**リクエスト**:
```json
{
  "plans": [
    { "subcategory_id": 1, "amount": 80000, "is_recurring": 1, "formula": "[{\"label\":\"家賃\",\"amount\":75000,\"multiplier\":1}]" },
    { "subcategory_id": 2, "amount": 5000, "is_recurring": 1, "formula": null }
  ]
}
```

- `formula`: 計算式モード時はJSON配列（`[{label, amount, multiplier}]`）、直接入力モード時は `null`
- `is_recurring`: 1=毎月繰越（前月コピー対象）、0=単月のみ

**レスポンス**: `200`（更新後の全プラン）

### POST `/api/budget-mgmt/plans/:yearMonth/copy-previous`
前月の繰越対象プラン（`is_recurring=1`）を当月にコピー。当月にプランが既に存在する場合はスキップ。`formula` カラムもコピーされる。

**レスポンス**: `200`
```json
{ "copied": 15 }
```

### GET `/api/budget-mgmt/income/:yearMonth`
指定月の収入を取得。

### PUT `/api/budget-mgmt/income/:yearMonth`
指定月の収入を保存（UPSERT）。

**リクエスト**: `{ "amount": 300000, "is_recurring": 1 }`

### POST `/api/budget-mgmt/income/:yearMonth/copy-previous`
前月の繰越対象収入を当月にコピー。

### GET `/api/budget-mgmt/actuals/:yearMonth`
指定月の実績一覧を取得。

### GET `/api/budget-mgmt/actuals/:yearMonth/summary`
指定月の実績をカテゴリ別に集計。

### POST `/api/budget-mgmt/actuals/import`
CSV データから実績を一括取込。`csv_id` で重複排除。

**集計期間ルール（15日締め）**: CSV の日付から `year_month` を自動判定。日 >= 15 → その月の期間、日 < 15 → 前月の期間。例: 3/1 の取引 → `2026-02`（2月度）、3/15 の取引 → `2026-03`（3月度）。

### DELETE `/api/budget-mgmt/actuals/:yearMonth`
指定月の実績を全削除。

---

## エラーハンドリング

一般的な HTTP ステータスコードを使用:

| ステータス | 意味 |
|-----------|------|
| `200 OK` | 成功 |
| `201 Created` | リソース作成成功 |
| `204 No Content` | 削除成功 |
| `404 Not Found` | リソースが見つからない（goals の PATCH/DELETE で使用） |
