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
  const { title, date, start_time, end_time, memo, source } = req.body;
  const result = db.prepare(
    'INSERT INTO schedules (title, date, start_time, end_time, memo, source) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, date, start_time || null, end_time || null, memo || null, source || null);
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

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const { title, date, start_time, end_time, memo } = req.body;
  db.prepare('UPDATE schedules SET title=?,date=?,start_time=?,end_time=?,memo=? WHERE id=?').run(
    title ?? existing.title, date ?? existing.date,
    start_time !== undefined ? (start_time || null) : existing.start_time,
    end_time !== undefined ? (end_time || null) : existing.end_time,
    memo !== undefined ? (memo || null) : existing.memo,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
