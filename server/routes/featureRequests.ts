import { Router } from 'express';
import db from '../db';

const router = Router();

// Get all feature requests ordered by sort_order
router.get('/', (_req, res) => {
  const items = db.prepare('SELECT * FROM feature_requests ORDER BY sort_order ASC, created_at ASC').all();
  res.json(items);
});

// Create feature request
router.post('/', (req, res) => {
  const { title, description } = req.body;
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) as m FROM feature_requests'
  ).get() as { m: number };

  const result = db.prepare(
    'INSERT INTO feature_requests (title, description, sort_order) VALUES (?, ?, ?)'
  ).run(title, description || '', maxOrder.m + 1);

  const item = db.prepare('SELECT * FROM feature_requests WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

// Update feature request
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM feature_requests WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const { title, description, status } = req.body;
  db.prepare(
    'UPDATE feature_requests SET title = ?, description = ?, status = ? WHERE id = ?'
  ).run(
    title ?? existing.title,
    description ?? existing.description,
    status ?? existing.status,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM feature_requests WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete feature request
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM feature_requests WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Reorder feature requests
router.post('/reorder', (req, res) => {
  const { orders } = req.body; // [{ id, sort_order }]
  const stmt = db.prepare('UPDATE feature_requests SET sort_order = ? WHERE id = ?');
  const tx = db.transaction((items: { id: number; sort_order: number }[]) => {
    for (const item of items) {
      stmt.run(item.sort_order, item.id);
    }
  });
  tx(orders);
  res.json({ ok: true });
});

export default router;
