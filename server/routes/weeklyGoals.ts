import { Router } from 'express';
import db from '../db';

const router = Router();

// GET /api/weekly-goals/:yearWeek  (e.g. 2026-W08)
router.get('/:yearWeek', (req, res) => {
  const row = db.prepare('SELECT * FROM weekly_goals WHERE year_week = ?').get(req.params.yearWeek);
  res.json(row ?? { year_week: req.params.yearWeek, content: '', memo: null });
});

// PUT /api/weekly-goals/:yearWeek
router.put('/:yearWeek', (req, res) => {
  const { content, memo } = req.body;
  db.prepare(`
    INSERT INTO weekly_goals (year_week, content, memo, updated_at)
    VALUES (?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(year_week) DO UPDATE SET
      content = excluded.content,
      memo = excluded.memo,
      updated_at = excluded.updated_at
  `).run(req.params.yearWeek, content ?? '', memo !== undefined ? (memo || null) : null);
  const row = db.prepare('SELECT * FROM weekly_goals WHERE year_week = ?').get(req.params.yearWeek);
  res.json(row);
});

export default router;
