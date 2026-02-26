import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/:date', (req, res) => {
  const entry = db.prepare('SELECT * FROM diary WHERE date = ?').get(req.params.date);
  res.json(entry || { date: req.params.date, content: '' });
});

router.put('/:date', (req, res) => {
  const { content } = req.body;
  const date = req.params.date;
  db.prepare(`
    INSERT INTO diary (date, content, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
    ON CONFLICT(date) DO UPDATE SET content = excluded.content, updated_at = datetime('now', 'localtime')
  `).run(date, content);
  const entry = db.prepare('SELECT * FROM diary WHERE date = ?').get(date);
  res.json(entry);
});

router.get('/', (_req, res) => {
  const entries = db.prepare('SELECT date, content FROM diary ORDER BY date DESC LIMIT 30').all();
  res.json(entries);
});

export default router;
