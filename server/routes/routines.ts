import { Router } from 'express';
import db from '../db';

const router = Router();

// Get all routines (optional ?day=N filter by weekday)
router.get('/', (req, res) => {
  const { day } = req.query;
  const all = db.prepare('SELECT * FROM routines ORDER BY sort_order ASC, created_at ASC').all() as Array<{ day_of_week: string; [k: string]: unknown }>;
  if (day !== undefined) {
    const filtered = all.filter(r => r.day_of_week.split(',').filter(Boolean).includes(String(day)));
    res.json(filtered);
  } else {
    res.json(all);
  }
});

// Create routine
router.post('/', (req, res) => {
  const { name, start_time, end_time, day_of_week } = req.body;
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) as m FROM routines'
  ).get() as { m: number };

  const result = db.prepare(
    'INSERT INTO routines (name, start_time, end_time, day_of_week, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(name, start_time, end_time, day_of_week || '', maxOrder.m + 1);

  const item = db.prepare('SELECT * FROM routines WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

// Update routine
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM routines WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const { name, start_time, end_time, day_of_week } = req.body;
  db.prepare(
    'UPDATE routines SET name = ?, start_time = ?, end_time = ?, day_of_week = ? WHERE id = ?'
  ).run(
    name ?? existing.name,
    start_time ?? existing.start_time,
    end_time ?? existing.end_time,
    day_of_week !== undefined ? day_of_week : existing.day_of_week,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM routines WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete routine
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM routines WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Reorder routines
router.post('/reorder', (req, res) => {
  const { orders } = req.body;
  const stmt = db.prepare('UPDATE routines SET sort_order = ? WHERE id = ?');
  const tx = db.transaction((items: { id: number; sort_order: number }[]) => {
    for (const item of items) {
      stmt.run(item.sort_order, item.id);
    }
  });
  tx(orders);
  res.json({ ok: true });
});

export default router;
