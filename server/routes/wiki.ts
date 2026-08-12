import { Router } from 'express';
import crypto from 'crypto';
import path from 'path';
import { mkdirSync, writeFileSync, existsSync, createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import db from '../db';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 画像保存先: DB と同じディレクトリ配下の uploads/ (本番は GCSFuse /data、ローカルは repo/data)
const dataDir = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(__dirname, '..', '..', 'data');
const uploadsDir = path.join(dataDir, 'uploads');

// Markdown → BlockNote JSON 変換 (lazy init — server-util は重いので初回利用時のみロード)
let serverEditor: { tryParseMarkdownToBlocks: (md: string) => Promise<unknown[]> } | null = null;
async function markdownToBlocks(markdown: string): Promise<string> {
  if (!serverEditor) {
    const { ServerBlockNoteEditor } = await import('@blocknote/server-util');
    serverEditor = ServerBlockNoteEditor.create();
  }
  const blocks = await serverEditor.tryParseMarkdownToBlocks(markdown);
  return JSON.stringify(blocks);
}

// ── Pages ──

// GET /api/wiki/pages — flat list (tree is built on the client)
router.get('/pages', (_req, res) => {
  const rows = db.prepare(
    'SELECT id, parent_id, title, sort_order, updated_at FROM wiki_pages ORDER BY sort_order, id'
  ).all();
  res.json(rows);
});

// GET /api/wiki/pages/:id — single page with content + diary links
router.get('/pages/:id', (req, res) => {
  const page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(req.params.id);
  if (!page) { res.status(404).json({ error: 'Not found' }); return; }
  const links = db.prepare('SELECT date FROM wiki_page_links WHERE page_id = ? ORDER BY date DESC').all(req.params.id) as { date: string }[];
  res.json({ ...page, links: links.map(l => l.date) });
});

// POST /api/wiki/pages — { title, parent_id?, content? | markdown? }
router.post('/pages', async (req, res) => {
  const { title, parent_id, content, markdown } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: 'title required' }); return; }

  let finalContent = content ?? '';
  if (markdown !== undefined) {
    try {
      finalContent = await markdownToBlocks(markdown);
    } catch (e) {
      res.status(500).json({ error: `Markdown conversion failed: ${e instanceof Error ? e.message : 'unknown'}` });
      return;
    }
  }

  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM wiki_pages WHERE parent_id IS ?'
  ).get(parent_id ?? null) as { next: number };

  const result = db.prepare(
    'INSERT INTO wiki_pages (parent_id, title, content, sort_order) VALUES (?, ?, ?, ?)'
  ).run(parent_id ?? null, title.trim(), finalContent, maxOrder.next);

  const page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(page);
});

// PATCH /api/wiki/pages/:id — { title?, content?, markdown?, parent_id?, sort_order? }
router.patch('/pages/:id', async (req, res) => {
  const existing = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const { title, content, markdown, parent_id, sort_order } = req.body;
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (title !== undefined) { sets.push('title = ?'); vals.push(title); }
  if (markdown !== undefined) {
    try {
      sets.push('content = ?');
      vals.push(await markdownToBlocks(markdown));
    } catch (e) {
      res.status(500).json({ error: `Markdown conversion failed: ${e instanceof Error ? e.message : 'unknown'}` });
      return;
    }
  } else if (content !== undefined) {
    sets.push('content = ?');
    vals.push(content);
  }
  if (parent_id !== undefined) { sets.push('parent_id = ?'); vals.push(parent_id); }
  if (sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(sort_order); }
  if (sets.length === 0) { res.status(400).json({ error: 'nothing to update' }); return; }

  sets.push("updated_at = datetime('now', 'localtime')");
  vals.push(req.params.id);
  db.prepare(`UPDATE wiki_pages SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  const page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(req.params.id);
  res.json(page);
});

// DELETE /api/wiki/pages/:id — cascades to children + links
router.delete('/pages/:id', (req, res) => {
  db.prepare('DELETE FROM wiki_pages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Diary links ──

// POST /api/wiki/pages/:id/links — { date }
router.post('/pages/:id/links', (req, res) => {
  const { date } = req.body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: 'date (YYYY-MM-DD) required' }); return; }
  try {
    db.prepare('INSERT INTO wiki_page_links (page_id, date) VALUES (?, ?)').run(req.params.id, date);
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Already linked' });
  }
});

// DELETE /api/wiki/pages/:id/links/:date
router.delete('/pages/:id/links/:date', (req, res) => {
  db.prepare('DELETE FROM wiki_page_links WHERE page_id = ? AND date = ?').run(req.params.id, req.params.date);
  res.json({ ok: true });
});

// GET /api/wiki/links?date=YYYY-MM-DD — pages linked to a diary date
router.get('/links', (req, res) => {
  const { date } = req.query;
  if (!date) { res.status(400).json({ error: 'date required' }); return; }
  const rows = db.prepare(
    `SELECT wp.id, wp.title FROM wiki_page_links wpl
     JOIN wiki_pages wp ON wpl.page_id = wp.id
     WHERE wpl.date = ? ORDER BY wp.title`
  ).all(date);
  res.json(rows);
});

// ── Images ──

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

// POST /api/wiki/images — { data: base64, mime } → { url }
router.post('/images', (req, res) => {
  const { data, mime } = req.body;
  const ext = MIME_EXT[mime];
  if (!data || !ext) { res.status(400).json({ error: 'data (base64) and supported mime required' }); return; }

  const buf = Buffer.from(data, 'base64');
  if (buf.length > 8 * 1024 * 1024) { res.status(413).json({ error: 'Image too large (max 8MB)' }); return; }

  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dir = path.join(uploadsDir, yyyy, mm);
  mkdirSync(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${ext}`;
  writeFileSync(path.join(dir, filename), buf);

  res.json({ url: `/api/wiki/images/${yyyy}/${mm}/${filename}` });
});

// GET /api/wiki/images/:year/:month/:filename — serve with long cache (UUID names are immutable)
router.get('/images/:year/:month/:filename', (req, res) => {
  const { year, month, filename } = req.params;
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^[a-f0-9-]+\.(png|jpe?g|gif|webp)$/.test(filename)) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }
  const filePath = path.join(uploadsDir, year, month, filename);
  if (!existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }

  const ext = filename.split('.').pop();
  const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  createReadStream(filePath).pipe(res);
});

export default router;
