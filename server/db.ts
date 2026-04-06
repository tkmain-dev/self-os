import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_PATH 環境変数があればそれを使用（Cloud Run + Cloud Storage）、なければデフォルト
const dbPath = process.env.DB_PATH ?? path.join(__dirname, '..', 'data', 'techo.db');

const db = new Database(dbPath);
db.pragma('journal_mode = DELETE');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS diary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    memo TEXT
  );

  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (parent_id) REFERENCES habits(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    UNIQUE(habit_id, date)
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    title TEXT NOT NULL,
    issue_type TEXT NOT NULL DEFAULT 'task',
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT 'amber',
    memo TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (parent_id) REFERENCES goals(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS feature_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'in_progress', 'done', 'rejected')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    commit_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS monthly_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS wish_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_type TEXT NOT NULL DEFAULT 'wish'
      CHECK(list_type IN ('wish', 'bucket')),
    title TEXT NOT NULL,
    price INTEGER,
    url TEXT,
    deadline TEXT,
    memo TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS weekly_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_week TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    memo TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    day_of_week TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS budget_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month TEXT NOT NULL UNIQUE,
    au_pay INTEGER,
    mufg_billing INTEGER,
    jcb_billing INTEGER,
    minsin_balance INTEGER,
    mufg_balance INTEGER,
    jcb_skip INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS budget_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('fixed', 'variable')),
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS budget_subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES budget_categories(id) ON DELETE CASCADE,
    UNIQUE(category_id, name)
  );

  CREATE TABLE IF NOT EXISTS budget_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month TEXT NOT NULL,
    subcategory_id INTEGER NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    is_recurring INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (subcategory_id) REFERENCES budget_subcategories(id) ON DELETE CASCADE,
    UNIQUE(year_month, subcategory_id)
  );

  CREATE TABLE IF NOT EXISTS budget_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL DEFAULT 0,
    is_recurring INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS budget_actuals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month TEXT NOT NULL,
    category_name TEXT NOT NULL,
    subcategory_name TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    amount INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    csv_id TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS kpt_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS kpt_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    year_week TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('keep', 'problem', 'try')),
    content TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    carried_from_id INTEGER,
    problem_status TEXT CHECK(problem_status IN ('resolved', 'unresolved', 'partial')),
    problem_reason TEXT,
    promoted_to_keep INTEGER NOT NULL DEFAULT 0,
    todo_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (category_id) REFERENCES kpt_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (carried_from_id) REFERENCES kpt_entries(id) ON DELETE SET NULL,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE SET NULL
  );
`);

// Migration: add resolved_keep column to kpt_entries
try {
  db.exec(`ALTER TABLE kpt_entries ADD COLUMN resolved_keep TEXT`);
} catch {
  // Column already exists
}

// Seed budget categories if empty
const catCount = db.prepare('SELECT COUNT(*) as c FROM budget_categories').get() as { c: number };
if (catCount.c === 0) {
  const insertCat = db.prepare('INSERT INTO budget_categories (name, type, sort_order) VALUES (?, ?, ?)');
  const insertSub = db.prepare('INSERT INTO budget_subcategories (category_id, name, sort_order) VALUES (?, ?, ?)');

  const seed: [string, 'fixed' | 'variable', string[]][] = [
    ['住宅', 'fixed', ['家賃', '管理費', '更新積立（年払いの月割）']],
    ['水道・光熱費', 'fixed', ['電気', 'ガス', '水道']],
    ['通信費', 'fixed', ['スマホ', '自宅ネット', 'サブスク（Netflix等）']],
    ['保険', 'fixed', ['医療保険', '生命保険', 'バイク保険']],
    ['税・社会保障', 'fixed', ['住民税', '年金（追加納付）', 'その他税']],
    ['自動車', 'fixed', ['ローン', '駐車場', '任意保険', '車検積立', 'ガソリン']],
    ['食費', 'variable', ['平日自炊', '平日外食', '休日外食', 'カフェ']],
    ['日用品', 'variable', ['消耗品', '家庭用品']],
    ['趣味・娯楽', 'variable', ['バイク関連', '旅行・登山', 'ゲーム', 'サウナ・ジム', 'サブイベント']],
    ['衣服・美容', 'variable', ['衣服', '美容院', 'スキンケア']],
    ['交通費', 'variable', ['通勤', 'プライベート移動']],
    ['交際費', 'variable', ['飲み会', 'デート', 'プレゼント']],
    ['教養・教育', 'variable', ['書籍', '資格', 'AIツール', 'オンライン講座']],
    ['健康・医療', 'variable', ['通院', '薬', 'サプリ']],
    ['特別な支出', 'variable', ['家電', '家具', '旅行大型出費', 'ギア買い替え']],
    ['その他', 'variable', ['未分類一時支出']],
  ];

  const seedTx = db.transaction(() => {
    seed.forEach(([name, type, subs], i) => {
      const result = insertCat.run(name, type, i);
      const catId = result.lastInsertRowid;
      subs.forEach((sub, j) => insertSub.run(catId, sub, j));
    });
  });
  seedTx();
}

// Migrations: add columns that may not exist in older DBs
try { db.exec(`ALTER TABLE feature_requests ADD COLUMN commit_message TEXT NOT NULL DEFAULT ''`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE habits ADD COLUMN parent_id INTEGER`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE habits ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE habits ADD COLUMN duration INTEGER NOT NULL DEFAULT 30`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE habits ADD COLUMN day_of_week TEXT NOT NULL DEFAULT ''`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE schedules ADD COLUMN source TEXT`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE goals ADD COLUMN note TEXT`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE goals ADD COLUMN scheduled_time TEXT`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE goals ADD COLUMN scheduled_duration INTEGER`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE routines ADD COLUMN memo TEXT`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE wish_items ADD COLUMN done_at TEXT`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE goals ADD COLUMN milestone_date TEXT`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE goals ADD COLUMN milestone_label TEXT`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE budget_plans ADD COLUMN formula TEXT`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE budget_income ADD COLUMN savings_target INTEGER NOT NULL DEFAULT 0`) } catch { /* already exists */ }

// ── FR#47: ポイント残高 + ウィッシュ月度計画 ──
db.exec(`
  CREATE TABLE IF NOT EXISTS point_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month TEXT NOT NULL,
    point_type TEXT NOT NULL CHECK(point_type IN ('jcb_jpoint', 'amazon', 'welfare')),
    balance INTEGER NOT NULL DEFAULT 0,
    exchange_rate REAL NOT NULL DEFAULT 1.0,
    exchange_label TEXT NOT NULL DEFAULT '',
    UNIQUE(year_month, point_type)
  );

  CREATE TABLE IF NOT EXISTS wish_month_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month TEXT NOT NULL,
    wish_item_id INTEGER NOT NULL,
    FOREIGN KEY (wish_item_id) REFERENCES wish_items(id) ON DELETE CASCADE,
    UNIQUE(year_month, wish_item_id)
  );
`);

export default db;
