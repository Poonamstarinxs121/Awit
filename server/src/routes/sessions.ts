import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const result = await pool.query(
      `SELECT
        a.id,
        a.name,
        a.model_config,
        a.status,
        a.created_at,
        COUNT(DISTINCT s.id) as session_count,
        MAX(s.last_active_at) as last_active,
        SUM(s.token_count) as total_tokens,
        SUM(u.tokens_in) as total_tokens_in,
        SUM(u.tokens_out) as total_tokens_out
       FROM agents a
       LEFT JOIN sessions s ON s.agent_id = a.id AND s.tenant_id = a.tenant_id
       LEFT JOIN usage_records u ON u.agent_id = a.id AND u.tenant_id = a.tenant_id
       WHERE a.tenant_id = $1
       GROUP BY a.id, a.name, a.model_config, a.status, a.created_at
       ORDER BY a.name ASC`,
      [tenantId]
    );

    const sessions = result.rows.map((row: any) => {
      const modelConfig = row.model_config || {};
      const model = modelConfig.model || 'unknown';
      const provider = modelConfig.provider || 'openai';

      const totalIn = parseInt(row.total_tokens_in || '0');
      const totalOut = parseInt(row.total_tokens_out || '0');
      const tokenCount = parseInt(row.total_tokens || '0');
      const totalTokens = totalIn + totalOut || tokenCount;

      return {
        id: row.id,
        agentName: row.name,
        agentEmoji: '🤖',
        agentColor: '#FF3B30',
        model,
        modelProvider: provider,
        status: row.status === 'active' ? 'online' : row.status === 'idle' ? 'idle' : 'offline',
        lastActive: row.last_active,
        messageCount: parseInt(row.session_count || '0'),
        messagesToday: 0,
        totalTokens,
        inputTokens: totalIn,
        outputTokens: totalOut,
      };
    });

    res.json({ sessions });
  } catch (error) {
    console.error('Sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

export default router;
