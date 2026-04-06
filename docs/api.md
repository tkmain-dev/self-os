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
| ポイント残高 | `/api/budget-mgmt/points` | `server/routes/budgetManagement.ts` |
| 月度購入計画 | `/api/budget-mgmt/wish-plans` | `server/routes/budgetManagement.ts` |
| AI分析 | `/api/budget-mgmt/analysis` | `server/routes/budgetManagement.ts` |
| KPT | `/api/kpt` | `server/routes/kpt.ts` |

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
前月の繰越対象プラン（`is_recurring=1`）を当月にコピー（UPSERT）。`formula` カラムもコピーされる。当月に既存プランがある場合は上書きされるため、再コピーで前月の値に戻すことが可能。

**レスポンス**: `200`
```json
{ "copied": 15 }
```

### GET `/api/budget-mgmt/income/:yearMonth`
指定月の収入を取得。

### PUT `/api/budget-mgmt/income/:yearMonth`
指定月の収入を保存（UPSERT）。

**リクエスト**: `{ "amount": 300000, "is_recurring": 1, "savings_target": 50000 }`

- `savings_target`: 貯金目標額（省略時は null。予実比較タブで余剰予算の計算に使用）

### POST `/api/budget-mgmt/income/:yearMonth/copy-previous`
前月の繰越対象収入を当月にコピー（UPSERT）。当月に既存データがある場合は上書き。再コピーで前月の値に戻すことが可能。

### GET `/api/budget-mgmt/actuals/:yearMonth`
指定月の実績一覧を取得。

### GET `/api/budget-mgmt/actuals/:yearMonth/summary`
指定月の実績をカテゴリ別に集計。

### POST `/api/budget-mgmt/actuals/import`
CSV データから実績を一括取込。`csv_id` で重複排除。

**集計期間ルール（15日締め）**: CSV の日付から `year_month` を自動判定。日 >= 15 → その月の期間、日 < 15 → 前月の期間。例: 3/1 の取引 → `2026-02`（2月度）、3/15 の取引 → `2026-03`（3月度）。

**パーサー仕様**:
- ダブルクォート囲み（RFC 4180 準拠）に対応。クォート内のカンマ・改行も正しく処理
- `category_name` が「未分類」のレコードは自動スキップ（取込対象外）
- リクエストボディの上限: 10MB（大容量CSVに対応）

### DELETE `/api/budget-mgmt/actuals/:yearMonth`
指定月の実績を全削除。

---

### GET `/api/budget-mgmt/points/:yearMonth`
指定月のポイント残高を全種別取得。

**パラメータ**: `yearMonth` — YYYY-MM

**レスポンス**: `200`
```json
[
  { "id": 1, "year_month": "2026-03", "point_type": "jcb",    "balance": 5000, "exchange_rate": 0.3,  "updated_at": "..." },
  { "id": 2, "year_month": "2026-03", "point_type": "amazon",  "balance": 1200, "exchange_rate": 1.0,  "updated_at": "..." },
  { "id": 3, "year_month": "2026-03", "point_type": "fukuri",  "balance": 3000, "exchange_rate": 1.0,  "updated_at": "..." }
]
```

### PUT `/api/budget-mgmt/points/:yearMonth`
指定月のポイント残高を一括保存（UPSERT）。送信したレコードのみ更新される。

**リクエスト**:
```json
[
  { "point_type": "jcb",   "balance": 5000, "exchange_rate": 0.3 },
  { "point_type": "amazon","balance": 1200, "exchange_rate": 1.0 },
  { "point_type": "fukuri","balance": 3000, "exchange_rate": 1.0 }
]
```

- `point_type`: `jcb` / `amazon` / `fukuri`
- `exchange_rate`: 1ポイント = N円。円換算額はフロントエンドで `balance × exchange_rate` として計算

**レスポンス**: `200`（更新後の全ポイントレコード）

---

### GET `/api/budget-mgmt/wish-plans/:yearMonth`
指定月の購入計画を取得（wish_items の詳細を JOIN して返す）。

**パラメータ**: `yearMonth` — YYYY-MM

**レスポンス**: `200`
```json
[
  {
    "id": 1,
    "year_month": "2026-03",
    "wish_item_id": 5,
    "planned_amount": 29800,
    "memo": "セール価格",
    "created_at": "...",
    "title": "AirPods Pro",
    "price": 29800,
    "deadline": "2026-03-31"
  }
]
```

### POST `/api/budget-mgmt/wish-plans/:yearMonth`
指定月の購入計画にアイテムを追加。

**リクエスト**:
```json
{ "wish_item_id": 5, "planned_amount": 29800, "memo": "セール価格" }
```

- `planned_amount` はオプション（省略時は wish_items の price を使用）
- `memo` はオプション

**レスポンス**: `201`（作成されたレコード）

### DELETE `/api/budget-mgmt/wish-plans/:yearMonth/:id`
指定月の購入計画エントリを削除。

**パラメータ**: `yearMonth` — YYYY-MM、`id` — wish_month_plans.id

**レスポンス**: `204`

---

### GET `/api/budget-mgmt/analysis/:yearMonth`
指定月の AI 分析結果をキャッシュから取得。

**パラメータ**: `yearMonth` — YYYY-MM

**レスポンス**: `200`（キャッシュ有り）
```json
{
  "year_month": "2026-03",
  "result": { "...": "分析結果JSON" },
  "created_at": "2026-04-01 12:00:00"
}
```

**レスポンス**: `404`（未分析 / キャッシュなし）

### POST `/api/budget-mgmt/analysis/:yearMonth`
Claude Sonnet API を呼び出して指定月の予実データを AI 分析し、結果を `budget_analyses` テーブルに保存する。

**パラメータ**: `yearMonth` — YYYY-MM

**リクエスト**: ボディなし

**処理フロー**:
1. 指定月の予算計画（`budget_plans`）・収入（`budget_income`）・実績（`budget_actuals`）を取得
2. カテゴリ別に集計したデータをプロンプトに組み込み、Claude Sonnet API へ送信
3. 分析結果を JSON にパースして `budget_analyses` テーブルに UPSERT 保存
4. 保存した結果をレスポンスとして返す

**レスポンス**: `200`
```json
{
  "year_month": "2026-03",
  "result": {
    "overall_score": 78,
    "grade": "B",
    "summary": "全体的に良好な予算管理ができています...",
    "categories": [
      {
        "name": "食費",
        "score": 65,
        "grade": "C",
        "comment": "予算超過が目立ちます。外食の頻度を見直しましょう",
        "top_expenses": ["スーパーA: 25,000円", "レストランB: 12,000円"]
      }
    ],
    "insights": ["固定費の割合が収入の45%を占めています", "..."],
    "saving_tips": ["食費を月1万円削減するとX万円貯蓄できます", "..."]
  },
  "created_at": "2026-04-01 12:00:00"
}
```

**エラー**:
- `500` — ANTHROPIC_API_KEY 未設定、または Claude API 呼び出し失敗

**環境変数**: `ANTHROPIC_API_KEY`（`.env.local` またはCloud Run環境変数で設定）

---

## KPT API (`/api/kpt`)

### GET `/api/kpt/categories`
全カテゴリを取得。ソート: `sort_order ASC, id ASC`

**レスポンス**: `200`
```json
[{ "id": 1, "name": "開発プロセス", "sort_order": 0, "created_at": "..." }]
```

### POST `/api/kpt/categories`
カテゴリを作成。

**リクエスト**: `{ "name": "カテゴリ名" }`
**レスポンス**: `200`

### PATCH `/api/kpt/categories/:id`
カテゴリを更新。`name`, `sort_order` を部分更新可能。

### DELETE `/api/kpt/categories/:id`
カテゴリを削除（関連エントリも CASCADE 削除）。

### GET `/api/kpt/entries?year_week=YYYY-Wnn`
指定週のエントリを取得。`carried_from_type`（引き継ぎ元の種別）を JOIN で返す。

**レスポンス**: `200`
```json
[{
  "id": 1,
  "category_id": 1,
  "year_week": "2026-W14",
  "type": "keep",
  "content": "毎朝のコードレビュー",
  "sort_order": 0,
  "carried_from_id": 5,
  "carried_from_type": "try",
  "problem_status": null,
  "problem_reason": null,
  "resolved_keep": null,
  "promoted_to_keep": 0,
  "todo_id": null,
  "created_at": "..."
}]
```

### POST `/api/kpt/entries`
エントリを作成。

**リクエスト**:
```json
{ "category_id": 1, "year_week": "2026-W14", "type": "keep", "content": "内容", "carried_from_id": null }
```

### PATCH `/api/kpt/entries/:id`
エントリを部分更新。`content`, `problem_status`, `problem_reason`, `resolved_keep`, `sort_order` を更新可能。

**副作用**:
- Try の `content` 更新時: 次週に Keep エントリを自動作成/同期（content が空なら削除）
- Problem の `problem_status` 更新時: `unresolved`/`partial` → 次週に Problem を自動引き継ぎ（理由付き）。`resolved` → 引き継ぎ削除

### DELETE `/api/kpt/entries/:id`
エントリを削除。Try の場合は次週の自動作成 Keep も連動削除。

### POST `/api/kpt/entries/:id/carry`
Keep エントリを次週に引き継ぎ。

**リクエスト**: `{ "target_week": "2026-W15" }`
**レスポンス**: `200`（作成されたエントリ）/ `409`（既に引き継ぎ済み）

### POST `/api/kpt/entries/:id/to-task`
Try エントリを Todo タスクに変換。

**レスポンス**: `200 { "ok": true, "todo_id": 123 }` / `409`（変換済み）

### GET `/api/kpt/stats`
改善成功率を取得。

**レスポンス**: `200`
```json
{
  "try_total": 10,
  "try_promoted": 4,
  "success_rate": 40,
  "problem_stats": [{ "problem_status": "resolved", "c": 5 }]
}
```

### GET `/api/kpt/prev-problems?year_week=YYYY-Wnn`
指定週の前週の Problem エントリを取得（カテゴリ名付き）。

---

## エラーハンドリング

一般的な HTTP ステータスコードを使用:

| ステータス | 意味 |
|-----------|------|
| `200 OK` | 成功 |
| `201 Created` | リソース作成成功 |
| `204 No Content` | 削除成功 |
| `404 Not Found` | リソースが見つからない（goals の PATCH/DELETE で使用） |
