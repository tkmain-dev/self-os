import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/', (_req, res) => {
  const todos = db.prepare('SELECT * FROM todos ORDER BY done ASC, created_at DESC').all();
  res.json(todos);
});

router.post('/', (req, res) => {
  const { title, due_date } = req.body;
  const result = db.prepare('INSERT INTO todos (title, due_date) VALUES (?, ?)').run(title, due_date || null);
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(todo);
});

router.patch('/:id', (req, res) => {
  const { done } = req.body;
  db.prepare('UPDATE todos SET done = ? WHERE id = ?').run(done ? 1 : 0, req.params.id);
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  res.json(todo);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
