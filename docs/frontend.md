# フロントエンド構成

## コンポーネント階層図

```mermaid
graph TB
    subgraph "App.tsx"
        App[App Component]
        Router[React Router]
    end

    subgraph "Layout.tsx"
        Layout[Layout Component]
        Sidebar[サイドバー]
        Main[メインエリア]
    end

    subgraph "DailyPage.tsx"
        DailyPage[DailyPage Component]
        ScheduleTimeline[ScheduleTimeline]
        DiarySection[DiarySection]
        HabitSection[HabitSection]
    end

    subgraph "GoalGantt.tsx"
        GoalGantt[GoalGantt Component]
        GoalForm[目標追加/編集フォーム]
        GanttChart[ガントチャート表示]
    end

    subgraph "Hooks"
        useApi[useApi Hook]
        apiPost[apiPost]
        apiPut[apiPut]
        apiPatch[apiPatch]
        apiDelete[apiDelete]
    end

    App --> Router
    Router --> Layout
    Layout --> Sidebar
    Layout --> Main
    Router --> DailyPage
    Router --> GoalGantt
    DailyPage --> ScheduleTimeline
    DailyPage --> DiarySection
    DailyPage --> HabitSection
    GoalGantt --> GoalForm
    GoalGantt --> GanttChart
    DailyPage --> useApi
    GoalGantt --> useApi
    ScheduleTimeline --> apiPost
    ScheduleTimeline --> apiDelete
    DiarySection --> apiPut
    HabitSection --> apiPost
    HabitSection --> apiDelete
    GoalGantt --> apiPost
    GoalGantt --> apiPatch
    GoalGantt --> apiDelete

    style App fill:#e1f5ff
    style Layout fill:#fff4e1
    style DailyPage fill:#e8f5e9
    style GoalGantt fill:#e8f5e9
    style useApi fill:#f3e5f5
```

## ルーティング構成

```mermaid
stateDiagram-v2
    [*] --> Root: アクセス
    Root --> Daily: /daily (デフォルト)
    Root --> Goals: /goals
    
    state Daily {
        [*] --> ScheduleTimeline
        [*] --> DiarySection
        [*] --> HabitSection
    }
    
    state Goals {
        [*] --> GoalList
        [*] --> GoalForm: 追加/編集時
    }
    
    Daily --> Goals: ナビゲーション
    Goals --> Daily: ナビゲーション
```

## コンポーネント詳細

### App.tsx

**役割**: アプリケーションのルートコンポーネント、ルーティング定義

```mermaid
classDiagram
    class App {
        +Routes
        +Route path="/"
        +Route path="/daily"
        +Route path="/goals"
    }
    
    App --> Layout
    App --> DailyPage
    App --> GoalGantt
```

### Layout.tsx

**役割**: 共通レイアウト（サイドバー + メインエリア）

```mermaid
classDiagram
    class Layout {
        -nav: Array~NavItem~
        +today(): string
        +render()
    }
    
    class NavItem {
        +to: string
        +label: string
        +icon: string
    }
    
    Layout --> NavItem
```

**機能**:
- サイドバーにナビゲーション表示
- 今日の日付表示
- アクティブなページのハイライト

### DailyPage.tsx

**役割**: デイリーページのメインコンポーネント

```mermaid
classDiagram
    class DailyPage {
        -date: string
        -isToday: boolean
        +changeDate(offset: number)
        +render()
    }
    
    class ScheduleTimeline {
        -schedules: ScheduleItem[]
        -showForm: boolean
        +fetchSchedules()
        +handleAdd()
        +handleDelete(id)
        +getEventStyle(item)
    }
    
    class DiarySection {
        -content: string
        -saved: boolean
        +handleSave()
    }
    
    class HabitSection {
        -habits: Habit[]
        -logs: HabitLog[]
        +fetchData()
        +handleToggle(habitId, date)
        +handleAdd()
        +handleDeleteHabit(id)
    }
    
    DailyPage --> ScheduleTimeline
    DailyPage --> DiarySection
    DailyPage --> HabitSection
```

**状態管理**:
- 選択中の日付（`date`）
- 各セクションのデータ（スケジュール、日記、習慣）

### GoalGantt.tsx

**役割**: 目標管理とガントチャート表示

```mermaid
classDiagram
    class GoalGantt {
        -goals: Goal[]
        -viewRange: ViewRange
        -offset: number
        -showForm: boolean
        -editId: number | null
        +handleSubmit()
        +handleDelete(id)
        +handleProgress(goal, progress)
        +openEdit(goal)
    }
    
    class Goal {
        +id: number
        +title: string
        +category: string
        +start_date: string
        +end_date: string
        +progress: number
        +color: string
        +memo: string
    }
    
    GoalGantt --> Goal
```

**機能**:
- 1ヶ月/3ヶ月/6ヶ月/1年の表示範囲切り替え
- 月単位のスクロール
- カテゴリ別のグループ化
- 進捗率の更新（+/-10%）
- 目標の追加・編集・削除

## カスタムフック

### useApi.ts

**役割**: API通信の共通ロジック

```mermaid
classDiagram
    class useApi {
        -data: T | null
        -loading: boolean
        +refetch(): void
    }
    
    class apiPost {
        +apiPost(url, body): Promise~T~
    }
    
    class apiPut {
        +apiPut(url, body): Promise~T~
    }
    
    class apiPatch {
        +apiPatch(url, body): Promise~T~
    }
    
    class apiDelete {
        +apiDelete(url): Promise~void~
    }
    
    useApi --> apiPost
    useApi --> apiPut
    useApi --> apiPatch
    useApi --> apiDelete
```

**使用例**:
```typescript
const { data: goals, loading, refetch } = useApi<Goal[]>('/api/goals');
```

## データフロー

### スケジュール追加のフロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as ScheduleTimeline
    participant Hook as useApi
    participant Server as Express API

    User->>UI: フォーム入力・送信
    UI->>Hook: apiPost('/api/schedules', {...})
    Hook->>Server: POST /api/schedules
    Server-->>Hook: レスポンス
    Hook-->>UI: 完了
    UI->>UI: fetchSchedules() 実行
    UI->>Hook: GET /api/schedules?date=...
    Hook->>Server: GET /api/schedules
    Server-->>Hook: スケジュール一覧
    Hook-->>UI: データ更新
    UI-->>User: UI更新（新規スケジュール表示）
```

### 日記保存のフロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as DiarySection
    participant Hook as useApi
    participant Server as Express API

    User->>UI: テキスト入力
    User->>UI: 保存ボタンクリック
    UI->>Hook: apiPut('/api/diary/2024-01-01', {content})
    Hook->>Server: PUT /api/diary/2024-01-01
    Server-->>Hook: 保存されたエントリ
    Hook-->>UI: 完了
    UI->>UI: setSaved(true)
    UI-->>User: "保存しました" 表示
```

## スタイリング

### デザインコンセプト

```mermaid
graph LR
    A[手帳風デザイン] --> B[サイドバー<br/>革調背景]
    A --> C[メインエリア<br/>紙のような背景]
    A --> D[罫線パターン]
    A --> E[アンバー系<br/>アクセントカラー]
```

**CSS構成**:
- `index.css`: グローバルスタイル、カスタムクラス
- Tailwind CSS: ユーティリティクラス
- カスタムクラス:
  - `.sidebar`: サイドバースタイル
  - `.sidebar-link`: ナビゲーションリンク
  - `.page-area`: メインエリア（罫線付き背景）
  - `.techo-heading`: 見出しスタイル
