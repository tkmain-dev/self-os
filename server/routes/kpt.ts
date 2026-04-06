import { Router } from 'express';
import db from '../db';

const router = Router();

function calcNextWeek(yearWeek: string): string {
  const [y, w] = yearWeek.replace('W', '').split('-').map(Number);
  const jan4 = new Date(y, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7 + 7);
  const ny = monday.getFullYear();
  const jan1 = new Date(ny, 0, 1);
  const doy = Math.floor((monday.getTime() - jan1.getTime()) / 86400000) + 1;
  const nw = Math.ceil((doy + jan1.getDay()) / 7);
  return `${ny}-W${String(nw).padStart(2, '0')}`;
}

// ── Categories ──

router.get('/categories', (_req, res) => {
  const rows = db.prepare('SELECT * FROM kpt_categories ORDER BY sort_order, id').all();
  res.json(rows);
});

router.post('/categories', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return; }
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM kpt_categories').get() as { next: number };
  const result = db.prepare('INSERT INTO kpt_categories (name, sort_order) VALUES (?, ?)').run(name.trim(), maxOrder.next);
  res.json({ id: result.lastInsertRowid, name: name.trim(), sort_order: maxOrder.next });
});

router.patch('/categories/:id', (req, res) => {
  const { name, sort_order } = req.body;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
  if (sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(sort_order); }
  if (sets.length === 0) { res.status(400).json({ error: 'nothing to update' }); return; }
  vals.push(req.params.id);
  db.prepare(`UPDATE kpt_categories SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

router.delete('/categories/:id', (req, res) => {
  db.prepare('DELETE FROM kpt_categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Entries ──

router.get('/entries', (req, res) => {
  const { year_week } = req.query;
  if (!year_week) { res.status(400).json({ error: 'year_week required' }); return; }
  const rows = db.prepare(
    `SELECT e.*, src.type AS carried_from_type
     FROM kpt_entries e
     LEFT JOIN kpt_entries src ON e.carried_from_id = src.id
     WHERE e.year_week = ?
     ORDER BY e.category_id, e.type, e.sort_order, e.id`
  ).all(year_week);
  res.json(rows);
});

router.post('/entries', (req, res) => {
  const { category_id, year_week, type, content, carried_from_id } = req.body;
  if (!category_id || !year_week || !type || content === undefined) {
    res.status(400).json({ error: 'category_id, year_week, type, content required' }); return;
  }
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM kpt_entries WHERE category_id = ? AND year_week = ? AND type = ?'
  ).get(category_id, year_week, type) as { next: number };
  const result = db.prepare(
    'INSERT INTO kpt_entries (category_id, year_week, type, content, sort_order, carried_from_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(category_id, year_week, type, content, maxOrder.next, carried_from_id ?? null);
  const row = db.prepare('SELECT * FROM kpt_entries WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
});

router.patch('/entries/:id', (req, res) => {
  const { content, problem_status, problem_reason, resolved_keep, sort_order } = req.body;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (content !== undefined) { sets.push('content = ?'); vals.push(content); }
  if (problem_status !== undefined) { sets.push('problem_status = ?'); vals.push(problem_status); }
  if (problem_reason !== undefined) { sets.push('problem_reason = ?'); vals.push(problem_reason); }
  if (resolved_keep !== undefined) { sets.push('resolved_keep = ?'); vals.push(resolved_keep); }
  if (sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(sort_order); }
  if (sets.length === 0) { res.status(400).json({ error: 'nothing to update' }); return; }
  vals.push(req.params.id);
  db.prepare(`UPDATE kpt_entries SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  const entry = db.prepare('SELECT * FROM kpt_entries WHERE id = ?').get(req.params.id) as {
    id: number; category_id: number; year_week: string; content: string; type: string;
    problem_status: string | null; problem_reason: string | null;
  } | undefined;

  // Auto-sync: Try content → next week's Keep
  if (content !== undefined && entry?.type === 'try') {
    const nextWeek = calcNextWeek(entry.year_week);
    if (entry.content.trim()) {
      const existing = db.prepare(
        'SELECT id FROM kpt_entries WHERE carried_from_id = ? AND year_week = ? AND type = ?'
      ).get(entry.id, nextWeek, 'keep') as { id: number } | undefined;
      if (existing) {
        db.prepare('UPDATE kpt_entries SET content = ? WHERE id = ?').run(entry.content, existing.id);
      } else {
        const maxOrder = db.prepare(
          'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM kpt_entries WHERE category_id = ? AND year_week = ? AND type = ?'
        ).get(entry.category_id, nextWeek, 'keep') as { next: number };
        db.prepare(
          'INSERT INTO kpt_entries (category_id, year_week, type, content, sort_order, carried_from_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(entry.category_id, nextWeek, 'keep', entry.content, maxOrder.next, entry.id);
      }
    } else {
      db.prepare(
        'DELETE FROM kpt_entries WHERE carried_from_id = ? AND year_week = ? AND type = ?'
      ).run(entry.id, nextWeek, 'keep');
    }
  }

  // Auto-sync: Problem status → next week's Problem (unresolved/partial carry forward)
  if ((problem_status !== undefined || problem_reason !== undefined) && entry?.type === 'problem') {
    const nextWeek = calcNextWeek(entry.year_week);
    if (entry.problem_status === 'unresolved' || entry.problem_status === 'partial') {
      const statusLabel = entry.problem_status === 'unresolved' ? '未解決' : '部分解決';
      const reasonNote = entry.problem_reason ? `（${statusLabel}: ${entry.problem_reason}）` : `（${statusLabel}）`;
      const carriedContent = entry.content;
      const existing = db.prepare(
        'SELECT id FROM kpt_entries WHERE carried_from_id = ? AND year_week = ? AND type = ?'
      ).get(entry.id, nextWeek, 'problem') as { id: number } | undefined;
      if (existing) {
        db.prepare('UPDATE kpt_entries SET content = ?, problem_reason = ? WHERE id = ?')
          .run(carriedContent, reasonNote, existing.id);
      } else {
        const maxOrder = db.prepare(
          'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM kpt_entries WHERE category_id = ? AND year_week = ? AND type = ?'
        ).get(entry.category_id, nextWeek, 'problem') as { next: number };
        db.prepare(
          'INSERT INTO kpt_entries (category_id, year_week, type, content, sort_order, carried_from_id, problem_reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(entry.category_id, nextWeek, 'problem', carriedContent, maxOrder.next, entry.id, reasonNote);
      }
    } else {
      // resolved or status cleared → remove carried problem
      db.prepare(
        'DELETE FROM kpt_entries WHERE carried_from_id = ? AND year_week = ? AND type = ?'
      ).run(entry.id, nextWeek, 'problem');
    }
  }

  res.json(entry);
});

router.delete('/entries/:id', (req, res) => {
  // If deleting a Try, also remove its auto-created next-week Keep
  const entry = db.prepare('SELECT id, type, year_week FROM kpt_entries WHERE id = ?').get(req.params.id) as {
    id: number; type: string; year_week: string;
  } | undefined;
  if (entry?.type === 'try') {
    const nextWeek = calcNextWeek(entry.year_week);
    db.prepare('DELETE FROM kpt_entries WHERE carried_from_id = ? AND year_week = ? AND type = ?')
      .run(entry.id, nextWeek, 'keep');
  }
  db.prepare('DELETE FROM kpt_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Carry Keep to next week ──

router.post('/entries/:id/carry', (req, res) => {
  const { target_week } = req.body;
  if (!target_week) { res.status(400).json({ error: 'target_week required' }); return; }
  const original = db.prepare('SELECT * FROM kpt_entries WHERE id = ?').get(req.params.id) as {
    id: number; category_id: number; type: string; content: string;
  } | undefined;
  if (!original || original.type !== 'keep') { res.status(400).json({ error: 'Can only carry Keep entries' }); return; }
  // Check if already carried
  const existing = db.prepare(
    'SELECT id FROM kpt_entries WHERE carried_from_id = ? AND year_week = ?'
  ).get(original.id, target_week);
  if (existing) { res.status(409).json({ error: 'Already carried' }); return; }
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM kpt_entries WHERE category_id = ? AND year_week = ? AND type = ?'
  ).get(original.category_id, target_week, 'keep') as { next: number };
  const result = db.prepare(
    'INSERT INTO kpt_entries (category_id, year_week, type, content, sort_order, carried_from_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(original.category_id, target_week, 'keep', original.content, maxOrder.next, original.id);
  const row = db.prepare('SELECT * FROM kpt_entries WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
});

// ── Convert Try to Task (Todo) ──

router.post('/entries/:id/to-task', (_req, res) => {
  const entry = db.prepare('SELECT * FROM kpt_entries WHERE id = ?').get(_req.params.id) as {
    id: number; type: string; content: string; todo_id: number | null;
  } | undefined;
  if (!entry || entry.type !== 'try') { res.status(400).json({ error: 'Can only convert Try entries' }); return; }
  if (entry.todo_id) { res.status(409).json({ error: 'Already converted', todo_id: entry.todo_id }); return; }
  const todoResult = db.prepare('INSERT INTO todos (title, done) VALUES (?, 0)').run(entry.content);
  db.prepare('UPDATE kpt_entries SET todo_id = ? WHERE id = ?').run(todoResult.lastInsertRowid, entry.id);
  res.json({ ok: true, todo_id: todoResult.lastInsertRowid });
});

// ── Stats: improvement success rate ──

router.get('/stats', (_req, res) => {
  // Count Tries that were promoted to Keep
  const total = db.prepare("SELECT COUNT(*) as c FROM kpt_entries WHERE type = 'try'").get() as { c: number };
  const promoted = db.prepare("SELECT COUNT(*) as c FROM kpt_entries WHERE type = 'try' AND promoted_to_keep = 1").get() as { c: number };
  // Count Problems by status
  const problems = db.prepare(`
    SELECT problem_status, COUNT(*) as c FROM kpt_entries
    WHERE type = 'problem' AND problem_status IS NOT NULL
    GROUP BY problem_status
  `).all() as { problem_status: string; c: number }[];
  res.json({
    try_total: total.c,
    try_promoted: promoted.c,
    success_rate: total.c > 0 ? Math.round((promoted.c / total.c) * 100) : 0,
    problem_stats: problems,
  });
});

// ── Previous week's problems (for reference display) ──

router.get('/prev-problems', (req, res) => {
  const { year_week } = req.query;
  if (!year_week) { res.status(400).json({ error: 'year_week required' }); return; }
  // Calculate previous week
  const [y, w] = (year_week as string).replace('W', '').split('-').map(Number);
  let prevYear = y;
  let prevWeek = w - 1;
  if (prevWeek < 1) {
    prevYear -= 1;
    // Get last week number of previous year (ISO 8601)
    const dec28 = new Date(prevYear, 11, 28);
    const dayOfYear = Math.floor((dec28.getTime() - new Date(prevYear, 0, 1).getTime()) / 86400000) + 1;
    prevWeek = Math.ceil((dayOfYear - dec28.getDay() + 10) / 7);
  }
  const prevYearWeek = `${prevYear}-W${String(prevWeek).padStart(2, '0')}`;
  const rows = db.prepare(
    "SELECT e.*, c.name as category_name FROM kpt_entries e JOIN kpt_categories c ON e.category_id = c.id WHERE e.year_week = ? AND e.type = 'problem' ORDER BY e.category_id, e.sort_order"
  ).all(prevYearWeek);
  res.json(rows);
});

export default router;
