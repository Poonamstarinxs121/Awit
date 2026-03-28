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
    'SELECT id, tenant_id FROM nodes WHERE id = $1 AND api_key_hash = $2 AND deleted_at IS NULL',
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
       FROM nodes WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
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
       FROM nodes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
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
    const { reason } = req.body || {};
    const result = await pool.query(
      `UPDATE nodes SET
         deleted_at = NOW(),
         deleted_by = $3,
         deletion_reason = $4
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id, tenantId, req.user!.userId, reason || null]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    await pool.query(
      `INSERT INTO deleted_nodes_history (node_id, tenant_id, deleted_by, deletion_reason, can_restore_until)
       SELECT id, tenant_id, $2, $3, NOW() + INTERVAL '30 days'
       FROM nodes WHERE id = $1
       ON CONFLICT (node_id) DO UPDATE SET
         deleted_by = EXCLUDED.deleted_by,
         deletion_reason = EXCLUDED.deletion_reason,
         deleted_at = NOW(),
         can_restore_until = NOW() + INTERVAL '30 days'`,
      [req.params.id, req.user!.userId, reason || null]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete node error:', error);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateNodeApiKey(req, res);
    if (!auth) return;
    const { target_node_id, message_type, payload } = req.body;
    if (!target_node_id || !message_type) {
      res.status(400).json({ error: 'target_node_id and message_type are required' });
      return;
    }
    const validTypes = ['agent_request', 'search_request', 'status_request', 'custom'];
    if (!validTypes.includes(message_type)) {
      res.status(400).json({ error: `message_type must be one of: ${validTypes.join(', ')}` });
      return;
    }
    const targetNode = await pool.query(
      'SELECT id FROM nodes WHERE id = $1 AND tenant_id = $2',
      [target_node_id, auth.tenantId]
    );
    if (targetNode.rows.length === 0) {
      res.status(404).json({ error: 'Target node not found or not in same tenant' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO node_messages (sender_node_id, target_node_id, message_type, payload)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [auth.nodeId, target_node_id, message_type, JSON.stringify(payload || {})]
    );
    res.json({ id: result.rows[0].id, created_at: result.rows[0].created_at });
  } catch (error) {
    console.error('Send node message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/:id/messages/inbox', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateNodeApiKey(req, res);
    if (!auth) return;
    const status = (req.query.status as string) || 'pending';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const result = await pool.query(
      `SELECT nm.id, nm.sender_node_id, n.name as sender_node_name, nm.message_type, nm.payload, nm.status, nm.created_at
       FROM node_messages nm
       JOIN nodes n ON n.id = nm.sender_node_id
       WHERE nm.target_node_id = $1 AND nm.status = $2
       ORDER BY nm.created_at ASC
       LIMIT $3`,
      [auth.nodeId, status, limit]
    );
    res.json({ messages: result.rows });
  } catch (error) {
    console.error('Get node inbox error:', error);
    res.status(500).json({ error: 'Failed to get inbox' });
  }
});

export const nodeMessagesRouter = Router();

nodeMessagesRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization' });
      return;
    }
    const token = authHeader.substring(7);
    const hash = hashApiKey(token);
    const messageId = req.params.id;
    const msgResult = await pool.query(
      `SELECT nm.id, nm.target_node_id, n.api_key_hash
       FROM node_messages nm
       JOIN nodes n ON n.id = nm.target_node_id
       WHERE nm.id = $1`,
      [messageId]
    );
    if (msgResult.rows.length === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    if (msgResult.rows[0].api_key_hash !== hash) {
      res.status(401).json({ error: 'Invalid node API key' });
      return;
    }
    const { status } = req.body;
    const validStatuses = ['delivered', 'processed', 'failed'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      return;
    }
    await pool.query(
      'UPDATE node_messages SET status = $1 WHERE id = $2',
      [status, messageId]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Update node message error:', error);
    res.status(500).json({ error: 'Failed to update message' });
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
