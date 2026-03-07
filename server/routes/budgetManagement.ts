import { Router } from 'express';
import db from '../db';

const router = Router();

// ── Categories & Subcategories ──

// GET /api/budget-mgmt/categories — full tree
router.get('/categories', (_req, res) => {
  const cats = db.prepare('SELECT * FROM budget_categories ORDER BY sort_order').all() as {
    id: number; name: string; type: string; sort_order: number;
  }[];
  const subs = db.prepare('SELECT * FROM budget_subcategories ORDER BY sort_order').all() as {
    id: number; category_id: number; name: string; sort_order: number;
  }[];

  const tree = cats.map(c => ({
    ...c,
    subcategories: subs.filter(s => s.category_id === c.id),
  }));
  res.json(tree);
});

// POST /api/budget-mgmt/subcategories — add subcategory
router.post('/subcategories', (req, res) => {
  const { category_id, name } = req.body;
  if (!category_id || !name) {
    res.status(400).json({ error: 'category_id and name are required' });
    return;
  }
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM budget_subcategories WHERE category_id = ?'
  ).get(category_id) as { next: number };

  const result = db.prepare(
    'INSERT INTO budget_subcategories (category_id, name, sort_order) VALUES (?, ?, ?)'
  ).run(category_id, name.trim(), maxOrder.next);

  const sub = db.prepare('SELECT * FROM budget_subcategories WHERE id = ?').get(result.lastInsertRowid);
  res.json(sub);
});

// PUT /api/budget-mgmt/subcategories/:id — rename subcategory
router.put('/subcategories/:id', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  db.prepare('UPDATE budget_subcategories SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  const sub = db.prepare('SELECT * FROM budget_subcategories WHERE id = ?').get(req.params.id);
  res.json(sub);
});

// DELETE /api/budget-mgmt/subcategories/:id
router.delete('/subcategories/:id', (req, res) => {
  db.prepare('DELETE FROM budget_subcategories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Budget Plans ──

// GET /api/budget-mgmt/plans/:yearMonth
router.get('/plans/:yearMonth', (req, res) => {
  const ym = req.params.yearMonth;
  const plans = db.prepare(`
    SELECT bp.*, bs.name as subcategory_name, bs.category_id, bc.name as category_name, bc.type as category_type
    FROM budget_plans bp
    JOIN budget_subcategories bs ON bp.subcategory_id = bs.id
    JOIN budget_categories bc ON bs.category_id = bc.id
    WHERE bp.year_month = ?
    ORDER BY bc.sort_order, bs.sort_order
  `).all(ym);
  res.json(plans);
});

// PUT /api/budget-mgmt/plans/:yearMonth — bulk upsert plans
router.put('/plans/:yearMonth', (req, res) => {
  const ym = req.params.yearMonth;
  const { plans } = req.body as { plans: { subcategory_id: number; amount: number; is_recurring: number; formula?: string | null }[] };

  if (!Array.isArray(plans)) {
    res.status(400).json({ error: 'plans array is required' });
    return;
  }

  const upsert = db.prepare(`
    INSERT INTO budget_plans (year_month, subcategory_id, amount, is_recurring, formula)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(year_month, subcategory_id) DO UPDATE SET
      amount = excluded.amount,
      is_recurring = excluded.is_recurring,
      formula = excluded.formula
  `);

  const tx = db.transaction(() => {
    for (const p of plans) {
      if (p.amount === 0 && !p.formula) {
        db.prepare('DELETE FROM budget_plans WHERE year_month = ? AND subcategory_id = ?').run(ym, p.subcategory_id);
      } else {
        upsert.run(ym, p.subcategory_id, p.amount, p.is_recurring ?? 1, p.formula ?? null);
      }
    }
  });
  tx();

  const updated = db.prepare(`
    SELECT bp.*, bs.name as subcategory_name, bs.category_id
    FROM budget_plans bp
    JOIN budget_subcategories bs ON bp.subcategory_id = bs.id
    WHERE bp.year_month = ?
  `).all(ym);
  res.json(updated);
});

// POST /api/budget-mgmt/plans/:yearMonth/copy-previous — copy recurring plans from previous month
router.post('/plans/:yearMonth/copy-previous', (req, res) => {
  const ym = req.params.yearMonth;
  const [y, m] = ym.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const existing = db.prepare('SELECT COUNT(*) as c FROM budget_plans WHERE year_month = ?').get(ym) as { c: number };
  if (existing.c > 0) {
    res.json({ copied: 0, message: 'Plans already exist for this month' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO budget_plans (year_month, subcategory_id, amount, is_recurring, formula)
    SELECT ?, subcategory_id, amount, is_recurring, formula
    FROM budget_plans
    WHERE year_month = ? AND is_recurring = 1
  `).run(ym, prevYm);

  res.json({ copied: result.changes });
});

// ── Income ──

// GET /api/budget-mgmt/income/:yearMonth
router.get('/income/:yearMonth', (req, res) => {
  const income = db.prepare('SELECT * FROM budget_income WHERE year_month = ?').get(req.params.yearMonth);
  res.json(income ?? { year_month: req.params.yearMonth, amount: 0, is_recurring: 1 });
});

// PUT /api/budget-mgmt/income/:yearMonth
router.put('/income/:yearMonth', (req, res) => {
  const ym = req.params.yearMonth;
  const { amount, is_recurring } = req.body;

  db.prepare(`
    INSERT INTO budget_income (year_month, amount, is_recurring)
    VALUES (?, ?, ?)
    ON CONFLICT(year_month) DO UPDATE SET amount = excluded.amount, is_recurring = excluded.is_recurring
  `).run(ym, amount ?? 0, is_recurring ?? 1);

  const income = db.prepare('SELECT * FROM budget_income WHERE year_month = ?').get(ym);
  res.json(income);
});

// POST /api/budget-mgmt/income/:yearMonth/copy-previous
router.post('/income/:yearMonth/copy-previous', (req, res) => {
  const ym = req.params.yearMonth;
  const [y, m] = ym.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const existing = db.prepare('SELECT * FROM budget_income WHERE year_month = ?').get(ym);
  if (existing) {
    res.json({ copied: false, message: 'Income already exists for this month' });
    return;
  }

  const prev = db.prepare('SELECT * FROM budget_income WHERE year_month = ? AND is_recurring = 1').get(prevYm) as { amount: number; is_recurring: number } | undefined;
  if (!prev) {
    res.json({ copied: false });
    return;
  }

  db.prepare('INSERT INTO budget_income (year_month, amount, is_recurring) VALUES (?, ?, ?)').run(ym, prev.amount, prev.is_recurring);
  res.json({ copied: true });
});

// ── CSV Import (Actuals) ──

// GET /api/budget-mgmt/actuals/:yearMonth
router.get('/actuals/:yearMonth', (req, res) => {
  const actuals = db.prepare(
    'SELECT * FROM budget_actuals WHERE year_month = ? ORDER BY date DESC, id DESC'
  ).all(req.params.yearMonth);
  res.json(actuals);
});

// GET /api/budget-mgmt/actuals/:yearMonth/summary — grouped by category
router.get('/actuals/:yearMonth/summary', (req, res) => {
  const summary = db.prepare(`
    SELECT category_name, SUM(amount) as total
    FROM budget_actuals
    WHERE year_month = ?
    GROUP BY category_name
    ORDER BY total ASC
  `).all(req.params.yearMonth);
  res.json(summary);
});

// POST /api/budget-mgmt/actuals/import — CSV import
router.post('/actuals/import', (req, res) => {
  const { rows } = req.body as {
    rows: {
      calc: string;
      date: string;
      description: string;
      amount: number;
      source: string;
      category: string;
      subcategory: string;
      memo: string;
      transfer: string;
      csv_id: string;
    }[];
  };

  if (!Array.isArray(rows)) {
    res.status(400).json({ error: 'rows array is required' });
    return;
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO budget_actuals (year_month, category_name, subcategory_name, date, description, amount, source, csv_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      // Only import rows with 計算対象=1
      if (row.calc !== '1') { skipped++; continue; }

      // Convert date: 2026/03/01 → year_month using 15th-closing rule
      // day >= 15 → that month's period; day < 15 → previous month's period
      const dateParts = row.date.split('/');
      if (dateParts.length < 2) { skipped++; continue; }
      const csvYear = parseInt(dateParts[0], 10);
      const csvMonth = parseInt(dateParts[1], 10);
      const csvDay = parseInt(dateParts[2] || '1', 10);
      const dateIso = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${(dateParts[2] || '01').padStart(2, '0')}`;

      let periodYear = csvYear;
      let periodMonth = csvMonth;
      if (csvDay < 15) {
        // Before 15th → belongs to previous month's period
        periodMonth -= 1;
        if (periodMonth < 1) { periodMonth = 12; periodYear -= 1; }
      }
      const yearMonth = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;

      const result = insert.run(
        yearMonth,
        row.category,
        row.subcategory || '',
        dateIso,
        row.description || '',
        row.amount,
        row.source || '',
        row.csv_id || null
      );

      if (result.changes > 0) imported++;
      else skipped++;
    }
  });
  tx();

  res.json({ imported, skipped });
});

// DELETE /api/budget-mgmt/actuals/:yearMonth — clear actuals for a month
router.delete('/actuals/:yearMonth', (req, res) => {
  const result = db.prepare('DELETE FROM budget_actuals WHERE year_month = ?').run(req.params.yearMonth);
  res.json({ deleted: result.changes });
});

export default router;
