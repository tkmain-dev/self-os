import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db';

const router = Router();

// Claude API client (lazy init)
let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

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

  const prevPlans = db.prepare(
    'SELECT subcategory_id, amount, is_recurring, formula FROM budget_plans WHERE year_month = ? AND is_recurring = 1'
  ).all(prevYm) as { subcategory_id: number; amount: number; is_recurring: number; formula: string | null }[];

  const upsert = db.prepare(`
    INSERT INTO budget_plans (year_month, subcategory_id, amount, is_recurring, formula)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(year_month, subcategory_id) DO UPDATE SET
      amount = excluded.amount,
      is_recurring = excluded.is_recurring,
      formula = excluded.formula
  `);

  const tx = db.transaction(() => {
    for (const p of prevPlans) {
      upsert.run(ym, p.subcategory_id, p.amount, p.is_recurring, p.formula);
    }
  });
  tx();

  res.json({ copied: prevPlans.length });
});

// ── Income ──

// GET /api/budget-mgmt/income/:yearMonth
router.get('/income/:yearMonth', (req, res) => {
  const income = db.prepare('SELECT * FROM budget_income WHERE year_month = ?').get(req.params.yearMonth);
  res.json(income ?? { year_month: req.params.yearMonth, amount: 0, is_recurring: 1, savings_target: 0 });
});

// PUT /api/budget-mgmt/income/:yearMonth
router.put('/income/:yearMonth', (req, res) => {
  const ym = req.params.yearMonth;
  const { amount, is_recurring, savings_target } = req.body;

  db.prepare(`
    INSERT INTO budget_income (year_month, amount, is_recurring, savings_target)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(year_month) DO UPDATE SET amount = excluded.amount, is_recurring = excluded.is_recurring, savings_target = excluded.savings_target
  `).run(ym, amount ?? 0, is_recurring ?? 1, savings_target ?? 0);

  const income = db.prepare('SELECT * FROM budget_income WHERE year_month = ?').get(ym);
  res.json(income);
});

// POST /api/budget-mgmt/income/:yearMonth/copy-previous
router.post('/income/:yearMonth/copy-previous', (req, res) => {
  const ym = req.params.yearMonth;
  const [y, m] = ym.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const prev = db.prepare('SELECT * FROM budget_income WHERE year_month = ? AND is_recurring = 1').get(prevYm) as { amount: number; is_recurring: number; savings_target: number } | undefined;
  if (!prev) {
    res.json({ copied: false });
    return;
  }

  db.prepare(`
    INSERT INTO budget_income (year_month, amount, is_recurring, savings_target)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(year_month) DO UPDATE SET amount = excluded.amount, is_recurring = excluded.is_recurring, savings_target = excluded.savings_target
  `).run(ym, prev.amount, prev.is_recurring, prev.savings_target ?? 0);
  res.json({ copied: true });
});

// POST /api/budget-mgmt/point-balances/:yearMonth/copy-previous
router.post('/point-balances/:yearMonth/copy-previous', (req, res) => {
  const ym = req.params.yearMonth;
  const [y, m] = ym.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const prevBalances = db.prepare(
    'SELECT point_type_id, balance, selected_rate_option_id FROM point_balances_v2 WHERE year_month = ?'
  ).all(prevYm) as { point_type_id: number; balance: number; selected_rate_option_id: number | null }[];

  const upsert = db.prepare(`
    INSERT INTO point_balances_v2 (year_month, point_type_id, balance, selected_rate_option_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(year_month, point_type_id) DO UPDATE SET balance = excluded.balance, selected_rate_option_id = excluded.selected_rate_option_id
  `);

  const tx = db.transaction(() => {
    for (const b of prevBalances) {
      upsert.run(ym, b.point_type_id, b.balance, b.selected_rate_option_id);
    }
  });
  tx();

  res.json({ copied: prevBalances.length });
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
      // Only import rows with 計算対象=1, skip 未分類
      if (row.calc !== '1') { skipped++; continue; }
      if (row.category === '未分類') { skipped++; continue; }

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

// ── Point Balances ──

// GET /api/budget-mgmt/points/:yearMonth
router.get('/points/:yearMonth', (req, res) => {
  const rows = db.prepare('SELECT * FROM point_balances WHERE year_month = ?').all(req.params.yearMonth);
  res.json(rows);
});

// PUT /api/budget-mgmt/points/:yearMonth — bulk upsert
router.put('/points/:yearMonth', (req, res) => {
  const ym = req.params.yearMonth;
  const { points } = req.body as {
    points: { point_type: string; balance: number; exchange_rate: number; exchange_label: string }[];
  };
  if (!Array.isArray(points)) { res.status(400).json({ error: 'points array required' }); return; }

  const upsert = db.prepare(`
    INSERT INTO point_balances (year_month, point_type, balance, exchange_rate, exchange_label)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(year_month, point_type) DO UPDATE SET balance = excluded.balance, exchange_rate = excluded.exchange_rate, exchange_label = excluded.exchange_label
  `);
  const del = db.prepare('DELETE FROM point_balances WHERE year_month = ? AND point_type = ?');

  const tx = db.transaction(() => {
    for (const p of points) {
      if (p.balance === 0) {
        del.run(ym, p.point_type);
      } else {
        upsert.run(ym, p.point_type, p.balance, p.exchange_rate, p.exchange_label);
      }
    }
  });
  tx();

  const rows = db.prepare('SELECT * FROM point_balances WHERE year_month = ?').all(ym);
  res.json(rows);
});

// ── Wish Month Plans ──

// GET /api/budget-mgmt/wish-plans/:yearMonth
router.get('/wish-plans/:yearMonth', (req, res) => {
  const rows = db.prepare(
    `SELECT wmp.id, wmp.year_month, wmp.wish_item_id, wi.title, wi.price
     FROM wish_month_plans wmp
     JOIN wish_items wi ON wmp.wish_item_id = wi.id
     WHERE wmp.year_month = ?
     ORDER BY wi.sort_order`
  ).all(req.params.yearMonth);
  res.json(rows);
});

// POST /api/budget-mgmt/wish-plans/:yearMonth
router.post('/wish-plans/:yearMonth', (req, res) => {
  const { wish_item_id } = req.body;
  if (!wish_item_id) { res.status(400).json({ error: 'wish_item_id required' }); return; }
  try {
    db.prepare('INSERT INTO wish_month_plans (year_month, wish_item_id) VALUES (?, ?)').run(req.params.yearMonth, wish_item_id);
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Already planned' });
  }
});

// DELETE /api/budget-mgmt/wish-plans/:yearMonth/:wishItemId
router.delete('/wish-plans/:yearMonth/:wishItemId', (req, res) => {
  db.prepare('DELETE FROM wish_month_plans WHERE year_month = ? AND wish_item_id = ?').run(req.params.yearMonth, req.params.wishItemId);
  res.json({ ok: true });
});

// ── FR#56: Point Types (user-defined) ──

interface PointTypeRow { id: number; name: string; sort_order: number }
interface PointRateRow { id: number; point_type_id: number; label: string; rate: number; sort_order: number }

router.get('/point-types', (_req, res) => {
  const types = db.prepare('SELECT * FROM point_types ORDER BY sort_order, id').all() as PointTypeRow[];
  const options = db.prepare('SELECT * FROM point_rate_options ORDER BY point_type_id, sort_order, id').all() as PointRateRow[];
  const result = types.map(t => ({
    ...t,
    rate_options: options.filter(o => o.point_type_id === t.id),
  }));
  res.json(result);
});

router.post('/point-types', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return; }
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM point_types').get() as { next: number };
  const result = db.prepare('INSERT INTO point_types (name, sort_order) VALUES (?, ?)').run(name.trim(), maxOrder.next);
  res.json({ id: result.lastInsertRowid, name: name.trim(), sort_order: maxOrder.next, rate_options: [] });
});

router.patch('/point-types/:id', (req, res) => {
  const { name, sort_order } = req.body;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
  if (sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(sort_order); }
  if (sets.length === 0) { res.status(400).json({ error: 'nothing to update' }); return; }
  vals.push(req.params.id);
  db.prepare(`UPDATE point_types SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

router.delete('/point-types/:id', (req, res) => {
  db.prepare('DELETE FROM point_types WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Rate options CRUD
router.post('/point-types/:id/rate-options', (req, res) => {
  const { label, rate } = req.body;
  if (!label?.trim() || typeof rate !== 'number') { res.status(400).json({ error: 'label and rate required' }); return; }
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM point_rate_options WHERE point_type_id = ?').get(req.params.id) as { next: number };
  const result = db.prepare('INSERT INTO point_rate_options (point_type_id, label, rate, sort_order) VALUES (?, ?, ?, ?)').run(req.params.id, label.trim(), rate, maxOrder.next);
  res.json({ id: result.lastInsertRowid, point_type_id: Number(req.params.id), label: label.trim(), rate, sort_order: maxOrder.next });
});

router.patch('/rate-options/:id', (req, res) => {
  const { label, rate } = req.body;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (label !== undefined) { sets.push('label = ?'); vals.push(label); }
  if (rate !== undefined) { sets.push('rate = ?'); vals.push(rate); }
  if (sets.length === 0) { res.status(400).json({ error: 'nothing to update' }); return; }
  vals.push(req.params.id);
  db.prepare(`UPDATE point_rate_options SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

router.delete('/rate-options/:id', (req, res) => {
  db.prepare('DELETE FROM point_rate_options WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── FR#56: New point balances API (using point_type_id) ──

router.get('/point-balances/:yearMonth', (req, res) => {
  const rows = db.prepare('SELECT * FROM point_balances_v2 WHERE year_month = ?').all(req.params.yearMonth);
  res.json(rows);
});

router.put('/point-balances/:yearMonth', (req, res) => {
  const ym = req.params.yearMonth;
  const { balances } = req.body as {
    balances: { point_type_id: number; balance: number; selected_rate_option_id: number | null }[];
  };
  if (!Array.isArray(balances)) { res.status(400).json({ error: 'balances array required' }); return; }

  const upsert = db.prepare(`
    INSERT INTO point_balances_v2 (year_month, point_type_id, balance, selected_rate_option_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(year_month, point_type_id) DO UPDATE SET balance = excluded.balance, selected_rate_option_id = excluded.selected_rate_option_id
  `);
  const del = db.prepare('DELETE FROM point_balances_v2 WHERE year_month = ? AND point_type_id = ?');

  const tx = db.transaction(() => {
    for (const b of balances) {
      if (b.balance === 0) {
        del.run(ym, b.point_type_id);
      } else {
        upsert.run(ym, b.point_type_id, b.balance, b.selected_rate_option_id);
      }
    }
  });
  tx();

  const rows = db.prepare('SELECT * FROM point_balances_v2 WHERE year_month = ?').all(ym);
  res.json(rows);
});

// ── AI Analysis ──

function getYearMonth(ym: string, offset: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function collectMonthData(ym: string, includeDetails = false) {
  const plans = db.prepare(`
    SELECT bp.amount, bs.name as sub_name, bc.name as cat_name, bc.type as cat_type
    FROM budget_plans bp
    JOIN budget_subcategories bs ON bp.subcategory_id = bs.id
    JOIN budget_categories bc ON bs.category_id = bc.id
    WHERE bp.year_month = ?
  `).all(ym) as { amount: number; sub_name: string; cat_name: string; cat_type: string }[];

  const actuals = db.prepare(`
    SELECT category_name, SUM(amount) as total
    FROM budget_actuals WHERE year_month = ?
    GROUP BY category_name
  `).all(ym) as { category_name: string; total: number }[];

  // Individual transactions for detailed analysis
  const transactions = includeDetails ? db.prepare(`
    SELECT category_name, subcategory_name, date, description, amount
    FROM budget_actuals WHERE year_month = ?
    ORDER BY category_name, date
  `).all(ym) as { category_name: string; subcategory_name: string; date: string; description: string; amount: number }[] : [];

  const income = db.prepare('SELECT * FROM budget_income WHERE year_month = ?').get(ym) as {
    amount: number; savings_target: number;
  } | undefined;

  return { plans, actuals, transactions, income: income ?? { amount: 0, savings_target: 0 } };
}

// GET cached analysis
router.get('/analysis/:yearMonth', (req, res) => {
  const row = db.prepare('SELECT * FROM budget_analyses WHERE year_month = ?').get(req.params.yearMonth) as {
    result: string; created_at: string;
  } | undefined;
  if (!row) { res.json(null); return; }
  res.json({ ...JSON.parse(row.result), created_at: row.created_at });
});

// POST run analysis (and cache)
router.post('/analysis/:yearMonth', async (req, res) => {
  const client = getAnthropic();
  if (!client) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
    return;
  }

  const ym = req.params.yearMonth;
  const current = collectMonthData(ym, true); // with transaction details
  const prev1 = collectMonthData(getYearMonth(ym, -1));
  const prev2 = collectMonthData(getYearMonth(ym, -2));

  // Build plan summary by category
  const buildPlanSummary = (data: ReturnType<typeof collectMonthData>) => {
    const byCat = new Map<string, { budget: number; type: string; subs: { name: string; amount: number }[] }>();
    for (const p of data.plans) {
      const cat = byCat.get(p.cat_name) ?? { budget: 0, type: p.cat_type, subs: [] };
      cat.budget += p.amount;
      cat.subs.push({ name: p.sub_name, amount: p.amount });
      byCat.set(p.cat_name, cat);
    }
    const actualMap = new Map(data.actuals.map(a => [a.category_name, a.total]));
    return [...byCat.entries()].map(([name, cat]) => ({
      category: name,
      type: cat.type,
      budget: cat.budget,
      actual: Math.abs(actualMap.get(name) ?? 0),
      diff: cat.budget - Math.abs(actualMap.get(name) ?? 0),
      subcategories: cat.subs,
    }));
  };

  const currentSummary = buildPlanSummary(current);
  const prev1Summary = buildPlanSummary(prev1);
  const prev2Summary = buildPlanSummary(prev2);

  const totalBudget = current.plans.reduce((s, p) => s + p.amount, 0);
  const totalActual = current.actuals.filter(a => a.category_name !== '収入').reduce((s, a) => s + Math.abs(a.total), 0);

  // Build transaction details grouped by category
  const txByCategory = new Map<string, { subcategory: string; date: string; description: string; amount: number }[]>();
  for (const tx of current.transactions) {
    if (tx.category_name === '収入' || tx.category_name === '現金・カード') continue;
    const list = txByCategory.get(tx.category_name) ?? [];
    list.push({ subcategory: tx.subcategory_name, date: tx.date, description: tx.description, amount: tx.amount });
    txByCategory.set(tx.category_name, list);
  }

  const txSection = [...txByCategory.entries()].map(([cat, txs]) => {
    return `【${cat}】\n${txs.map(t => `  ${t.date} ${t.description} ¥${Math.abs(t.amount).toLocaleString()} (${t.subcategory})`).join('\n')}`;
  }).join('\n\n');

  const prompt = `あなたは個人の家計管理の専門アドバイザーです。以下の予算・実績データとCSV明細を詳細に分析し、JSONで構造化された分析結果を返してください。

重要: カテゴリごとに「なぜその金額になったか」をCSV明細から具体的に読み取り、超過・節約の原因を特定してください。

## データ（${ym}月度、15日締め）

### 収入・貯金
- 収入予算: ¥${current.income.amount.toLocaleString()}
- 貯金目標: ¥${current.income.savings_target.toLocaleString()}
- 支出予算合計: ¥${totalBudget.toLocaleString()}
- 支出実績合計: ¥${totalActual.toLocaleString()}

### カテゴリ別予実（当月）
${currentSummary.map(c => `- ${c.category}(${c.type === 'fixed' ? '固定' : '変動'}): 予算¥${c.budget.toLocaleString()} / 実績¥${c.actual.toLocaleString()} / 差異¥${c.diff.toLocaleString()}\n  内訳: ${c.subcategories.map(s => `${s.name}=¥${s.amount.toLocaleString()}`).join(', ')}`).join('\n')}

### CSV明細（当月の全取引）
${txSection || '（明細データなし）'}

### 前月カテゴリ別
${prev1Summary.map(c => `- ${c.category}: 予算¥${c.budget.toLocaleString()} / 実績¥${c.actual.toLocaleString()}`).join('\n') || '（データなし）'}

### 前々月カテゴリ別
${prev2Summary.map(c => `- ${c.category}: 予算¥${c.budget.toLocaleString()} / 実績¥${c.actual.toLocaleString()}`).join('\n') || '（データなし）'}

## 回答形式
以下のJSON形式で回答してください。JSONのみ返し、他のテキストは含めないでください。

{
  "overview": {
    "score": 0-100の数値（予算管理の総合スコア）,
    "grade": "A"〜"F"の評価,
    "summary": "2-3文の総評。具体的な数字を含めること"
  },
  "categories": [
    {
      "name": "カテゴリ名のみ（例: '食費'）。'(固定)'や'(変動)'は付けないこと",
      "status": "good" | "warning" | "over",
      "analysis": "CSV明細を根拠にした2-3文の詳細分析。具体的にどの支出が原因で超過/節約になったかを明記。例: 『外食が8回で¥12,000を占め、予算の60%を消費。特に3/20の飲み会¥5,000が大きい』",
      "top_expenses": ["金額が大きい支出TOP3を「内容 ¥金額」形式で"],
      "trend": "up" | "down" | "stable",
      "trend_detail": "前月・前々月と比較した具体的なトレンド説明"
    }
  ],
  "insights": [
    {
      "type": "warning" | "positive" | "tip",
      "title": "具体的な見出し",
      "detail": "CSV明細に基づく詳細な説明。抽象的でなく、具体的な支出項目や金額に言及すること"
    }
  ],
  "savings_tips": [
    "CSV明細の具体的な支出パターンに基づく、実行可能な節約提案。金額の目安も含める"
  ]
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: 'Failed to parse analysis' });
      return;
    }
    const analysis = JSON.parse(jsonMatch[0]);
    // Cache result
    db.prepare(`
      INSERT INTO budget_analyses (year_month, result)
      VALUES (?, ?)
      ON CONFLICT(year_month) DO UPDATE SET result = excluded.result, created_at = datetime('now', 'localtime')
    `).run(ym, JSON.stringify(analysis));
    res.json(analysis);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Analysis failed: ${msg}` });
  }
});

export default router;
