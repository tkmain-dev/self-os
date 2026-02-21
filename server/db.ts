import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'techo.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
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
`);

// Migrations: add columns that may not exist in older DBs
try { db.exec(`ALTER TABLE feature_requests ADD COLUMN commit_message TEXT NOT NULL DEFAULT ''`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE habits ADD COLUMN parent_id INTEGER`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE habits ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE habits ADD COLUMN duration INTEGER NOT NULL DEFAULT 30`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE habits ADD COLUMN day_of_week TEXT NOT NULL DEFAULT ''`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE schedules ADD COLUMN source TEXT`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE goals ADD COLUMN note TEXT`) } catch { /* already exists */ }

export default db;
