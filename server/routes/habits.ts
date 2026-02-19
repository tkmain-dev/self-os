import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/', (_req, res) => {
  const habits = db.prepare('SELECT * FROM habits ORDER BY sort_order ASC, created_at ASC').all();
  res.json(habits);
});

router.post('/', (req, res) => {
  const { name, parent_id } = req.body;
  const pid = parent_id ?? null;
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) as m FROM habits WHERE COALESCE(parent_id, -1) = ?'
  ).get(pid ?? -1) as { m: number };
  const result = db.prepare(
    'INSERT INTO habits (name, parent_id, sort_order) VALUES (?, ?, ?)'
  ).run(name, pid, maxOrder.m + 1);
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(habit);
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM habits WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, duration, day_of_week } = req.body;
  db.prepare('UPDATE habits SET name=?, duration=?, day_of_week=? WHERE id=?').run(
    name ?? existing.name,
    duration !== undefined ? duration : existing.duration,
    day_of_week !== undefined ? day_of_week : existing.day_of_week,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM habits WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM habits WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

router.get('/logs', (req, res) => {
  const { from, to } = req.query;
  const logs = db.prepare('SELECT * FROM habit_logs WHERE date >= ? AND date <= ?').all(from, to);
  res.json(logs);
});

router.post('/:id/logs', (req, res) => {
  const { date } = req.body;
  const habitId = req.params.id;
  try {
    db.prepare('INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)').run(habitId, date);
    res.status(201).json({ habit_id: Number(habitId), date });
  } catch {
    db.prepare('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?').run(habitId, date);
    res.json({ deleted: true, habit_id: Number(habitId), date });
  }
});

export default router;
