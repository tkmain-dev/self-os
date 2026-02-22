import { Router } from 'express';
import db from '../db';

const router = Router();

// Propagate date range up to parent: parent spans min(children start) ~ max(children end)
function syncParentDates(childParentId: unknown) {
  if (!childParentId) return;
  const range = db.prepare(
    'SELECT MIN(start_date) as min_start, MAX(end_date) as max_end FROM goals WHERE parent_id = ?'
  ).get(childParentId) as { min_start: string | null; max_end: string | null };
  if (range.min_start && range.max_end) {
    db.prepare('UPDATE goals SET start_date = ?, end_date = ? WHERE id = ?')
      .run(range.min_start, range.max_end, childParentId);
    // Recurse upward
    const parent = db.prepare('SELECT parent_id FROM goals WHERE id = ?').get(childParentId) as { parent_id: unknown } | undefined;
    if (parent) syncParentDates(parent.parent_id);
  }
}

// Get all goals (flat list, frontend builds tree)
router.get('/', (req, res) => {
  const { from, to } = req.query;
  if (from && to) {
    const goals = db.prepare('SELECT * FROM goals WHERE start_date <= ? AND end_date >= ? ORDER BY sort_order ASC, created_at ASC').all(to, from);
    res.json(goals);
  } else {
    const goals = db.prepare('SELECT * FROM goals ORDER BY sort_order ASC, created_at ASC').all();
    res.json(goals);
  }
});

// Create goal
router.post('/', (req, res) => {
  const { parent_id, title, issue_type, status, priority, category, start_date, end_date, color, memo, note, scheduled_time, scheduled_duration } = req.body;
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) as m FROM goals WHERE COALESCE(parent_id, 0) = ?'
  ).get(parent_id || 0) as { m: number };

  const result = db.prepare(
    `INSERT INTO goals (parent_id, title, issue_type, status, priority, category, start_date, end_date, color, memo, note, sort_order, scheduled_time, scheduled_duration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    parent_id || null,
    title,
    issue_type || 'task',
    status || 'todo',
    priority || 'medium',
    category || '',
    start_date,
    end_date,
    color || 'amber',
    memo || null,
    note || null,
    maxOrder.m + 1,
    scheduled_time || null,
    scheduled_duration || null,
  );
  syncParentDates(parent_id || null);
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(goal);
});

// Update goal
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const { parent_id, title, issue_type, status, priority, category, start_date, end_date, progress, color, memo, note, sort_order, scheduled_time, scheduled_duration } = req.body;

  db.prepare(
    `UPDATE goals SET parent_id = ?, title = ?, issue_type = ?, status = ?, priority = ?, category = ?,
     start_date = ?, end_date = ?, progress = ?, color = ?, memo = ?, note = ?, sort_order = ?,
     scheduled_time = ?, scheduled_duration = ? WHERE id = ?`
  ).run(
    parent_id !== undefined ? (parent_id || null) : existing.parent_id,
    title ?? existing.title,
    issue_type ?? existing.issue_type,
    status ?? existing.status,
    priority ?? existing.priority,
    category ?? existing.category,
    start_date ?? existing.start_date,
    end_date ?? existing.end_date,
    progress ?? existing.progress,
    color ?? existing.color,
    memo ?? existing.memo,
    note !== undefined ? note : existing.note,
    sort_order ?? existing.sort_order,
    scheduled_time !== undefined ? (scheduled_time || null) : existing.scheduled_time,
    scheduled_duration !== undefined ? (scheduled_duration || null) : existing.scheduled_duration,
    req.params.id
  );
  // Sync parent dates after updating this goal
  const updated = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  syncParentDates(updated.parent_id);
  res.json(updated);
});

// Delete goal (cascade deletes children)
router.delete('/:id', (req, res) => {
  // Get parent before deleting
  const goal = db.prepare('SELECT parent_id FROM goals WHERE id = ?').get(req.params.id) as { parent_id: unknown } | undefined;
  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
  if (goal) syncParentDates(goal.parent_id);
  res.status(204).end();
});

// Reorder goals
router.post('/reorder', (req, res) => {
  const { orders } = req.body; // [{ id, sort_order }]
  const stmt = db.prepare('UPDATE goals SET sort_order = ? WHERE id = ?');
  const tx = db.transaction((items: { id: number; sort_order: number }[]) => {
    for (const item of items) {
      stmt.run(item.sort_order, item.id);
    }
  });
  tx(orders);
  res.json({ ok: true });
});

export default router;
