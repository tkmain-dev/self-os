import { Router } from 'express';
import db from '../db';

const router = Router();

interface BudgetEntry {
  id: number;
  year_month: string;
  au_pay: number | null;
  mufg_billing: number | null;
  jcb_billing: number | null;
  minsin_balance: number | null;
  mufg_balance: number | null;
  jcb_skip: number;
  created_at: string;
  updated_at: string;
}

// GET /api/budget — list recent 24 months
router.get('/', (_req, res) => {
  const entries = db.prepare(
    'SELECT * FROM budget_entries ORDER BY year_month DESC LIMIT 24'
  ).all();
  res.json(entries);
});

// GET /api/budget/:yearMonth — get or return empty record
router.get('/:yearMonth', (req, res) => {
  const entry = db.prepare('SELECT * FROM budget_entries WHERE year_month = ?').get(req.params.yearMonth) as BudgetEntry | undefined;
  if (entry) {
    res.json(entry);
  } else {
    res.json({
      year_month: req.params.yearMonth,
      au_pay: null,
      mufg_billing: null,
      jcb_billing: null,
      minsin_balance: null,
      mufg_balance: null,
      jcb_skip: 0,
    });
  }
});

// PUT /api/budget/:yearMonth — upsert
router.put('/:yearMonth', (req, res) => {
  const { au_pay, mufg_billing, jcb_billing, minsin_balance, mufg_balance, jcb_skip } = req.body;
  const ym = req.params.yearMonth;

  db.prepare(`
    INSERT INTO budget_entries (year_month, au_pay, mufg_billing, jcb_billing, minsin_balance, mufg_balance, jcb_skip, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(year_month) DO UPDATE SET
      au_pay = excluded.au_pay,
      mufg_billing = excluded.mufg_billing,
      jcb_billing = excluded.jcb_billing,
      minsin_balance = excluded.minsin_balance,
      mufg_balance = excluded.mufg_balance,
      jcb_skip = excluded.jcb_skip,
      updated_at = excluded.updated_at
  `).run(
    ym,
    au_pay ?? null,
    mufg_billing ?? null,
    jcb_billing ?? null,
    minsin_balance ?? null,
    mufg_balance ?? null,
    jcb_skip ?? 0,
  );

  const entry = db.prepare('SELECT * FROM budget_entries WHERE year_month = ?').get(ym);
  res.json(entry);
});

export default router;
