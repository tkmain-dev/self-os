import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/', (req, res) => {
  const { date, from, to } = req.query;
  if (date) {
    const schedules = db.prepare('SELECT * FROM schedules WHERE date = ? ORDER BY start_time ASC').all(date);
    res.json(schedules);
  } else if (from && to) {
    const schedules = db.prepare('SELECT * FROM schedules WHERE date >= ? AND date <= ? ORDER BY date ASC, start_time ASC').all(from, to);
    res.json(schedules);
  } else {
    const schedules = db.prepare('SELECT * FROM schedules ORDER BY date ASC, start_time ASC').all();
    res.json(schedules);
  }
});

router.post('/', (req, res) => {
  const { title, date, start_time, end_time, memo } = req.body;
  const result = db.prepare(
    'INSERT INTO schedules (title, date, start_time, end_time, memo) VALUES (?, ?, ?, ?, ?)'
  ).run(title, date, start_time || null, end_time || null, memo || null);
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(schedule);
});

router.put('/:id', (req, res) => {
  const { title, date, start_time, end_time, memo } = req.body;
  db.prepare(
    'UPDATE schedules SET title = ?, date = ?, start_time = ?, end_time = ?, memo = ? WHERE id = ?'
  ).run(title, date, start_time || null, end_time || null, memo || null, req.params.id);
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  res.json(schedule);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
