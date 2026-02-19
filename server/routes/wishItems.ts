import { Router } from 'express';
import db from '../db';

const router = Router();

// Get all wish items by list_type
router.get('/', (req, res) => {
  const listType = req.query.type || 'wish';
  const items = db.prepare(
    'SELECT * FROM wish_items WHERE list_type = ? ORDER BY sort_order ASC, created_at ASC'
  ).all(listType);
  res.json(items);
});

// Create wish item
router.post('/', (req, res) => {
  const { list_type, title, price, url, deadline, memo } = req.body;
  const type = list_type || 'wish';
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) as m FROM wish_items WHERE list_type = ?'
  ).get(type) as { m: number };

  const result = db.prepare(
    'INSERT INTO wish_items (list_type, title, price, url, deadline, memo, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(type, title, price ?? null, url ?? null, deadline ?? null, memo ?? null, maxOrder.m + 1);

  const item = db.prepare('SELECT * FROM wish_items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

// Update wish item
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM wish_items WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const { title, price, url, deadline, memo, done } = req.body;
  db.prepare(
    'UPDATE wish_items SET title = ?, price = ?, url = ?, deadline = ?, memo = ?, done = ? WHERE id = ?'
  ).run(
    title ?? existing.title,
    price !== undefined ? price : existing.price,
    url !== undefined ? url : existing.url,
    deadline !== undefined ? deadline : existing.deadline,
    memo !== undefined ? memo : existing.memo,
    done !== undefined ? done : existing.done,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM wish_items WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete wish item
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM wish_items WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Reorder wish items
router.post('/reorder', (req, res) => {
  const { orders } = req.body;
  const stmt = db.prepare('UPDATE wish_items SET sort_order = ? WHERE id = ?');
  const tx = db.transaction((items: { id: number; sort_order: number }[]) => {
    for (const item of items) {
      stmt.run(item.sort_order, item.id);
    }
  });
  tx(orders);
  res.json({ ok: true });
});

export default router;
