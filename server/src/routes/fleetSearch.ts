import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { query, node_ids, include_hub } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const allResults: any[] = [];

    if (include_hub !== false) {
      try {
        const memoryResults = await pool.query(
          `SELECT id, agent_id, content, memory_type, created_at
           FROM memory_entries
           WHERE tenant_id = $1 AND content ILIKE $2
           ORDER BY created_at DESC LIMIT 20`,
          [tenantId, `%${query}%`]
        );
        for (const row of memoryResults.rows) {
          const snippet = extractSnippet(row.content, query);
          allResults.push({
            type: 'memory',
            title: `${row.memory_type} memory`,
            snippet,
            source: 'hub',
            node_id: null,
            node_name: 'Hub',
            agent_id: row.agent_id,
            created_at: row.created_at,
          });
        }
      } catch {}
    }

    const nodesResult = await pool.query(
      `SELECT id, name, url, status FROM nodes WHERE tenant_id = $1 AND status != 'offline'`,
      [tenantId]
    );

    const targetNodes = node_ids
      ? nodesResult.rows.filter((n: any) => node_ids.includes(n.id))
      : nodesResult.rows;

    const nodeSearchPromises = targetNodes.map(async (node: any) => {
      if (!node.url) return [];
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const nodeRes = await fetch(`${node.url}/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!nodeRes.ok) return [];
        const data = await nodeRes.json();
        return (data.results || []).map((r: any) => ({
          ...r,
          source: 'node',
          node_id: node.id,
          node_name: node.name,
        }));
      } catch {
        return [];
      }
    });

    const nodeResults = await Promise.all(nodeSearchPromises);
    for (const results of nodeResults) {
      allResults.push(...results);
    }

    res.json({ results: allResults, total: allResults.length });
  } catch (error) {
    console.error('Fleet search error:', error);
    res.status(500).json({ error: 'Failed to perform fleet search' });
  }
});

function extractSnippet(content: string, query: string): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return content.substring(0, 200);
  const start = Math.max(0, idx - 80);
  const end = Math.min(content.length, idx + query.length + 80);
  let snippet = content.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

export default router;
