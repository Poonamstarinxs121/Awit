import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';

const router = Router();

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): string {
  return 'sqn_' + crypto.randomBytes(32).toString('hex');
}

async function authenticateNodeApiKey(req: Request, res: Response): Promise<{ nodeId: string; tenantId: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization' });
    return null;
  }
  const token = authHeader.substring(7);
  const hash = hashApiKey(token);
  const nodeId = req.params.id;
  const result = await pool.query(
    'SELECT id, tenant_id FROM nodes WHERE id = $1 AND api_key_hash = $2',
    [nodeId, hash]
  );
  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Invalid node API key' });
    return null;
  }
  return { nodeId: result.rows[0].id, tenantId: result.rows[0].tenant_id };
}

router.post('/register', authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, url } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const result = await pool.query(
      `INSERT INTO nodes (tenant_id, name, url, api_key_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [tenantId, name, url || null, apiKeyHash]
    );
    res.json({
      node_id: result.rows[0].id,
      api_key: apiKey,
      registered_at: result.rows[0].created_at,
      message: 'Node registered. Save the API key — it will not be shown again.'
    });
  } catch (error) {
    console.error('Node register error:', error);
    res.status(500).json({ error: 'Failed to register node' });
  }
});

router.get('/', authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const result = await pool.query(
      `SELECT id, name, url, status, last_heartbeat, system_info, openclaw_version, agent_count, created_at, updated_at
       FROM nodes WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json({ nodes: result.rows });
  } catch (error) {
    console.error('List nodes error:', error);
    res.status(500).json({ error: 'Failed to list nodes' });
  }
});

router.get('/:id', authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const nodeResult = await pool.query(
      `SELECT id, name, url, status, last_heartbeat, system_info, openclaw_version, agent_count, created_at, updated_at
       FROM nodes WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId]
    );
    if (nodeResult.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const heartbeats = await pool.query(
      `SELECT cpu_percent, memory_percent, disk_percent, uptime_seconds, agent_statuses, created_at
       FROM node_heartbeats WHERE node_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC LIMIT 100`,
      [req.params.id]
    );
    const telemetry = await pool.query(
      `SELECT telemetry_type, payload, recorded_at, created_at
       FROM node_telemetry WHERE node_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({
      node: nodeResult.rows[0],
      heartbeats: heartbeats.rows,
      telemetry: telemetry.rows,
    });
  } catch (error) {
    console.error('Get node error:', error);
    res.status(500).json({ error: 'Failed to get node' });
  }
});

router.post('/:id/heartbeat', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateNodeApiKey(req, res);
    if (!auth) return;
    const { cpu_percent, memory_percent, disk_percent, uptime_seconds, agent_statuses, openclaw_version } = req.body;
    await pool.query(
      `UPDATE nodes SET
        status = 'online',
        last_heartbeat = NOW(),
        agent_count = $1,
        system_info = $2,
        openclaw_version = $3,
        updated_at = NOW()
       WHERE id = $4`,
      [
        Array.isArray(agent_statuses) ? agent_statuses.length : 0,
        JSON.stringify({ cpu_percent, memory_percent, disk_percent, uptime_seconds }),
        openclaw_version || null,
        auth.nodeId,
      ]
    );
    await pool.query(
      `INSERT INTO node_heartbeats (node_id, cpu_percent, memory_percent, disk_percent, uptime_seconds, agent_statuses)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [auth.nodeId, cpu_percent || 0, memory_percent || 0, disk_percent || 0, uptime_seconds || 0, JSON.stringify(agent_statuses || [])]
    );
    await pool.query(
      `DELETE FROM node_heartbeats WHERE node_id = $1 AND created_at < NOW() - INTERVAL '7 days'`,
      [auth.nodeId]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

router.post('/:id/telemetry', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateNodeApiKey(req, res);
    if (!auth) return;
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'Entries array is required' });
      return;
    }
    for (const entry of entries) {
      await pool.query(
        `INSERT INTO node_telemetry (node_id, telemetry_type, payload, recorded_at)
         VALUES ($1, $2, $3, $4)`,
        [auth.nodeId, entry.type, JSON.stringify(entry.payload || {}), entry.recorded_at || new Date().toISOString()]
      );
    }
    res.json({ ok: true, count: entries.length });
  } catch (error) {
    console.error('Telemetry error:', error);
    res.status(500).json({ error: 'Failed to process telemetry' });
  }
});

router.delete('/:id', authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const role = req.user!.role;
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json({ error: 'Only owners and admins can remove nodes' });
      return;
    }
    const result = await pool.query(
      'DELETE FROM nodes WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, tenantId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete node error:', error);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

export default router;

let statusCheckerStarted = false;

export function startNodeStatusChecker() {
  if (statusCheckerStarted) return;
  statusCheckerStarted = true;
  setInterval(async () => {
    try {
      await pool.query(
        `UPDATE nodes SET status = 'degraded', updated_at = NOW()
         WHERE status = 'online' AND last_heartbeat < NOW() - INTERVAL '90 seconds'`
      );
      await pool.query(
        `UPDATE nodes SET status = 'offline', updated_at = NOW()
         WHERE status IN ('online', 'degraded') AND last_heartbeat < NOW() - INTERVAL '3 minutes'`
      );
    } catch (error) {
      console.error('Node status check error:', error);
    }
  }, 60000);
}
