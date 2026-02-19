import { Router } from 'express';
import db from '../db';

const router = Router();

// GET /api/monthly-goals/:yearMonth  (e.g. 2026-02)
router.get('/:yearMonth', (req, res) => {
  const row = db.prepare('SELECT * FROM monthly_goals WHERE year_month = ?').get(req.params.yearMonth);
  res.json(row ?? { year_month: req.params.yearMonth, content: '' });
});

// PUT /api/monthly-goals/:yearMonth
router.put('/:yearMonth', (req, res) => {
  const { content } = req.body;
  db.prepare(`
    INSERT INTO monthly_goals (year_month, content, updated_at)
    VALUES (?, ?, datetime('now', 'localtime'))
    ON CONFLICT(year_month) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `).run(req.params.yearMonth, content ?? '');
  const row = db.prepare('SELECT * FROM monthly_goals WHERE year_month = ?').get(req.params.yearMonth);
  res.json(row);
});

export default router;
