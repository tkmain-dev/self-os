import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const habits = db.prepare('SELECT * FROM habits ORDER BY created_at ASC').all();
  res.json(habits);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  const result = db.prepare('INSERT INTO habits (name) VALUES (?)').run(name);
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(habit);
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
