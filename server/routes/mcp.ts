import { Router, type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import db from '../db';
import { markdownToBlocks, blocksToMarkdown } from './wiki';

// FR#61: claude.ai (Cowork / モバイル / Web) カスタムコネクタ用 MCP サーバー。
// /mcp/<MCP_SECRET> のシークレットパスで保護（server/index.ts でマウント）。

const router = Router();

interface WikiPageRow {
  id: number;
  parent_id: number | null;
  title: string;
  content: string;
  sort_order: number;
  updated_at: string;
}

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

function pageTreeText(): string {
  const rows = db.prepare(
    'SELECT id, parent_id, title FROM wiki_pages ORDER BY sort_order, id'
  ).all() as { id: number; parent_id: number | null; title: string }[];
  if (rows.length === 0) return '(ページがありません)';
  const children = new Map<number | null, typeof rows>();
  for (const r of rows) {
    const list = children.get(r.parent_id) ?? [];
    list.push(r);
    children.set(r.parent_id, list);
  }
  const lines: string[] = [];
  const walk = (parentId: number | null, depth: number) => {
    for (const r of children.get(parentId) ?? []) {
      lines.push(`${'  '.repeat(depth)}- [id:${r.id}] ${r.title || '無題'}`);
      walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return lines.join('\n');
}

function buildServer(): McpServer {
  const server = new McpServer({ name: 'techo-wiki', version: '1.0.0' });

  server.tool(
    'wiki_list_pages',
    'Wiki のページツリー（全ページの id・タイトル・階層構造）を取得する。ページの作成・更新・削除の前に必ず呼び出して構造を確認すること。',
    {},
    async () => text(pageTreeText())
  );

  server.tool(
    'wiki_read_page',
    '指定した Wiki ページの本文（Markdown）と関連日記の日付一覧を取得する。',
    { page_id: z.number().describe('ページID（wiki_list_pages で確認）') },
    async ({ page_id }) => {
      const page = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(page_id) as WikiPageRow | undefined;
      if (!page) return text(`エラー: ページ id=${page_id} は存在しません`);
      const links = db.prepare('SELECT date FROM wiki_page_links WHERE page_id = ? ORDER BY date DESC').all(page_id) as { date: string }[];
      const md = await blocksToMarkdown(page.content);
      return text(
        `# ${page.title || '無題'}\n(id: ${page.id}, parent_id: ${page.parent_id ?? 'なし(ルート)'}, 最終更新: ${page.updated_at})\n` +
        `関連日記: ${links.length > 0 ? links.map(l => l.date).join(', ') : 'なし'}\n\n---\n\n${md || '(本文なし)'}`
      );
    }
  );

  server.tool(
    'wiki_create_page',
    'Wiki ページを新規作成する。本文は Markdown で指定。親ページ配下に置く場合は parent_id を指定（事前に wiki_list_pages で適切な親とタイトル重複を確認すること）。',
    {
      title: z.string().describe('ページタイトル'),
      markdown: z.string().optional().describe('本文（Markdown）。省略時は空ページ'),
      parent_id: z.number().nullable().optional().describe('親ページID。ルートに置く場合は省略または null'),
    },
    async ({ title, markdown, parent_id }) => {
      if (!title.trim()) return text('エラー: title が空です');
      const pid = parent_id ?? null;
      if (pid !== null) {
        const parent = db.prepare('SELECT id FROM wiki_pages WHERE id = ?').get(pid);
        if (!parent) return text(`エラー: 親ページ id=${pid} は存在しません`);
      }
      const content = markdown ? await markdownToBlocks(markdown) : '';
      const maxOrder = db.prepare(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM wiki_pages WHERE parent_id IS ?'
      ).get(pid) as { next: number };
      const result = db.prepare(
        'INSERT INTO wiki_pages (parent_id, title, content, sort_order) VALUES (?, ?, ?, ?)'
      ).run(pid, title.trim(), content, maxOrder.next);
      return text(`作成しました: [id:${result.lastInsertRowid}] ${title.trim()}${pid !== null ? ` (親: id=${pid})` : ' (ルート)'}`);
    }
  );

  server.tool(
    'wiki_update_page',
    'Wiki ページを更新する。markdown を渡すと本文全体が差し替えられる（追記したい場合は wiki_read_page で既存本文を読み、全文を組み立てて渡すこと）。title で改名、parent_id でツリー移動。',
    {
      page_id: z.number().describe('ページID'),
      title: z.string().optional().describe('新しいタイトル（変更する場合のみ）'),
      markdown: z.string().optional().describe('新しい本文（Markdown、全体差し替え）'),
      parent_id: z.number().nullable().optional().describe('移動先の親ページID（ルートへは null）'),
    },
    async ({ page_id, title, markdown, parent_id }) => {
      const existing = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get(page_id) as WikiPageRow | undefined;
      if (!existing) return text(`エラー: ページ id=${page_id} は存在しません`);
      if (parent_id === page_id) return text('エラー: 自分自身を親にはできません');

      const sets: string[] = [];
      const vals: unknown[] = [];
      if (title !== undefined) { sets.push('title = ?'); vals.push(title); }
      if (markdown !== undefined) { sets.push('content = ?'); vals.push(await markdownToBlocks(markdown)); }
      if (parent_id !== undefined) { sets.push('parent_id = ?'); vals.push(parent_id); }
      if (sets.length === 0) return text('エラー: 更新内容が指定されていません');

      sets.push("updated_at = datetime('now', 'localtime')");
      vals.push(page_id);
      db.prepare(`UPDATE wiki_pages SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      return text(`更新しました: [id:${page_id}] ${title ?? existing.title}`);
    }
  );

  server.tool(
    'wiki_delete_page',
    'Wiki ページを削除する。子ページも連鎖削除されるため、事前に wiki_list_pages で子の有無を確認し、子がある場合はユーザーの意図を確認してから実行すること。',
    { page_id: z.number().describe('ページID') },
    async ({ page_id }) => {
      const existing = db.prepare('SELECT title FROM wiki_pages WHERE id = ?').get(page_id) as { title: string } | undefined;
      if (!existing) return text(`エラー: ページ id=${page_id} は存在しません`);
      const childCount = db.prepare('SELECT COUNT(*) AS c FROM wiki_pages WHERE parent_id = ?').get(page_id) as { c: number };
      db.prepare('DELETE FROM wiki_pages WHERE id = ?').run(page_id);
      return text(`削除しました: ${existing.title || '無題'}${childCount.c > 0 ? `（子ページ ${childCount.c} 件も削除）` : ''}`);
    }
  );

  server.tool(
    'wiki_link_diary',
    'Wiki ページを指定日の日記と相互リンクする（アプリのデイリーページ・Wikiページ双方にチップ表示される）。',
    {
      page_id: z.number().describe('ページID'),
      date: z.string().describe('日記の日付（YYYY-MM-DD）'),
    },
    async ({ page_id, date }) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return text('エラー: date は YYYY-MM-DD 形式で指定してください');
      const existing = db.prepare('SELECT title FROM wiki_pages WHERE id = ?').get(page_id) as { title: string } | undefined;
      if (!existing) return text(`エラー: ページ id=${page_id} は存在しません`);
      try {
        db.prepare('INSERT INTO wiki_page_links (page_id, date) VALUES (?, ?)').run(page_id, date);
        return text(`リンクしました: 「${existing.title || '無題'}」 ↔ ${date} の日記`);
      } catch {
        return text(`すでにリンク済みです: 「${existing.title || '無題'}」 ↔ ${date}`);
      }
    }
  );

  return server;
}

// Stateless Streamable HTTP: リクエストごとに server + transport を生成
router.post('/', async (req: Request, res: Response) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error('MCP error:', e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// Stateless のため GET(SSE)/DELETE(セッション終了) は未対応
router.get('/', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed' },
    id: null,
  });
});
router.delete('/', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed' },
    id: null,
  });
});

export default router;
