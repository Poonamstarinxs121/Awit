import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';

const router = Router();

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function authenticateNodeApiKey(req: Request, res: Response, nodeIdParam: string): Promise<{ nodeId: string; tenantId: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization' });
    return null;
  }
  const token = authHeader.substring(7);
  const hash = hashApiKey(token);
  const result = await pool.query(
    'SELECT id, tenant_id FROM nodes WHERE id = $1 AND api_key_hash = $2',
    [nodeIdParam, hash]
  );
  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Invalid node API key' });
    return null;
  }
  return { nodeId: result.rows[0].id, tenantId: result.rows[0].tenant_id };
}

router.post('/tasks/:id/dispatch', authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const role = req.user!.role;
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json({ error: 'Only owners and admins can dispatch tasks' });
      return;
    }
    const taskId = req.params.id;
    const { node_id } = req.body;
    if (!node_id) {
      res.status(400).json({ error: 'node_id is required' });
      return;
    }
    const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1 AND tenant_id = $2', [taskId, tenantId]);
    if (taskCheck.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const nodeCheck = await pool.query(
      'SELECT id, name, status FROM nodes WHERE id = $1 AND tenant_id = $2',
      [node_id, tenantId]
    );
    if (nodeCheck.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    if (nodeCheck.rows[0].status === 'offline') {
      res.status(400).json({ error: 'Cannot dispatch to an offline node' });
      return;
    }
    await pool.query('UPDATE tasks SET target_node_id = $1 WHERE id = $2', [node_id, taskId]);
    const dispatch = await pool.query(
      `INSERT INTO task_dispatches (task_id, node_id, status, dispatched_at)
       VALUES ($1, $2, 'dispatched', NOW()) RETURNING *`,
      [taskId, node_id]
    );
    res.status(201).json(dispatch.rows[0]);
  } catch (error) {
    console.error('Dispatch task error:', error);
    res.status(500).json({ error: 'Failed to dispatch task' });
  }
});

router.get('/tasks/:id/dispatch', authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const taskId = req.params.id;
    const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1 AND tenant_id = $2', [taskId, tenantId]);
    if (taskCheck.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const dispatches = await pool.query(
      `SELECT td.*, n.name as node_name
       FROM task_dispatches td
       JOIN nodes n ON td.node_id = n.id
       WHERE td.task_id = $1
       ORDER BY td.created_at DESC`,
      [taskId]
    );
    res.json({ dispatches: dispatches.rows });
  } catch (error) {
    console.error('Get dispatch error:', error);
    res.status(500).json({ error: 'Failed to get dispatch status' });
  }
});

router.get('/tasks/dispatch-by-node/:nodeId', authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const nodeId = req.params.nodeId;
    const status = req.query.status as string | undefined;

    const nodeCheck = await pool.query('SELECT id FROM nodes WHERE id = $1 AND tenant_id = $2', [nodeId, tenantId]);
    if (nodeCheck.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    let query = `SELECT td.*, t.title as task_title, t.description as task_description, t.priority as task_priority, n.name as node_name
       FROM task_dispatches td
       JOIN tasks t ON td.task_id = t.id
       JOIN nodes n ON td.node_id = n.id
       WHERE td.node_id = $1`;
    const params: any[] = [nodeId];

    if (status) {
      params.push(status);
      query += ` AND td.status = $${params.length}`;
    }

    query += ` ORDER BY td.created_at DESC LIMIT 50`;

    const dispatches = await pool.query(query, params);
    res.json({ dispatches: dispatches.rows });
  } catch (error) {
    console.error('Get node dispatches error:', error);
    res.status(500).json({ error: 'Failed to get node dispatches' });
  }
});

router.patch('/task-dispatches/:id', async (req: Request, res: Response) => {
  try {
    const dispatchId = req.params.id;
    const dispatchCheck = await pool.query(
      'SELECT td.id, td.node_id FROM task_dispatches td WHERE td.id = $1',
      [dispatchId]
    );
    if (dispatchCheck.rows.length === 0) {
      res.status(404).json({ error: 'Dispatch not found' });
      return;
    }
    const nodeId = dispatchCheck.rows[0].node_id;
    const auth = await authenticateNodeApiKey(req, res, nodeId);
    if (!auth) return;

    const { status, result: dispatchResult, error: dispatchError } = req.body;
    const validStatuses = ['accepted', 'running', 'completed', 'failed'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const updates: string[] = ['status = $1'];
    const params: any[] = [status];
    let idx = 2;

    if (status === 'accepted') {
      updates.push(`accepted_at = NOW()`);
    } else if (status === 'completed' || status === 'failed') {
      updates.push(`completed_at = NOW()`);
    }
    if (dispatchResult !== undefined) {
      updates.push(`result = $${idx++}`);
      params.push(JSON.stringify(dispatchResult));
    }
    if (dispatchError !== undefined) {
      updates.push(`error = $${idx++}`);
      params.push(dispatchError);
    }
    params.push(dispatchId);

    const updated = await pool.query(
      `UPDATE task_dispatches SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Update dispatch error:', error);
    res.status(500).json({ error: 'Failed to update dispatch' });
  }
});

router.get('/nodes/:id/dispatches', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateNodeApiKey(req, res, req.params.id);
    if (!auth) return;

    const status = req.query.status as string || 'dispatched';
    const dispatches = await pool.query(
      `SELECT td.*, t.title as task_title, t.description as task_description, t.priority as task_priority
       FROM task_dispatches td
       JOIN tasks t ON td.task_id = t.id
       WHERE td.node_id = $1 AND td.status = $2
       ORDER BY td.created_at ASC
       LIMIT 50`,
      [auth.nodeId, status]
    );
    res.json({ dispatches: dispatches.rows });
  } catch (error) {
    console.error('List node dispatches error:', error);
    res.status(500).json({ error: 'Failed to list dispatches' });
  }
});

export default router;
