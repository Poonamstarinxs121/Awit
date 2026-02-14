import { Router, Request, Response } from 'express';
import multer from 'multer';
import { pool } from '../db/index.js';
import { logActivity } from '../services/activityService.js';
import { requireMinRole } from '../middleware/rbac.js';
import { emitTaskEvent, emitActivityEvent } from '../services/eventEmitter.js';
import { parseMentionsAndNotify } from '../services/notificationService.js';
import { subscribeToThread, notifyThreadSubscribers } from '../services/threadService.js';
import { saveDeliverable, getTaskDeliverables, deleteDeliverable } from '../services/deliverableService.js';
import { fireWebhookEvent } from '../services/webhookService.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const PRIORITY_ORDER: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };

router.get('/stats', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT status, COUNT(*)::int as count FROM tasks WHERE tenant_id = $1 GROUP BY status`,
      [req.user!.tenantId]
    );
    res.json({ stats: result.rows });
  } catch (error) {
    console.error('Task stats error:', error);
    res.status(500).json({ error: 'Failed to get task stats' });
  }
});

router.get('/', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const { status, assignee, priority, search } = req.query;
    const tenantId = req.user!.tenantId;
    const conditions = ['t.tenant_id = $1'];
    const values: unknown[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`t.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }
    if (assignee) {
      conditions.push(`$${paramIndex} = ANY(t.assignees)`);
      values.push(assignee);
      paramIndex++;
    }
    if (priority) {
      conditions.push(`t.priority = $${paramIndex}`);
      values.push(priority);
      paramIndex++;
    }
    if (search) {
      conditions.push(`t.title ILIKE $${paramIndex}`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const result = await pool.query(
      `SELECT t.*,
              (SELECT json_agg(json_build_object('id', a.id, 'name', a.name))
               FROM agents a WHERE a.id = ANY(t.assignees) AND a.tenant_id = t.tenant_id
              ) as assignee_agents
       FROM tasks t
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
         t.created_at DESC`,
      values
    );

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

router.post('/', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { title, description, status, priority, assignees, tags, due_date, parent_task } = req.body;
    const tenantId = req.user!.tenantId;
    const userName = req.user!.name;

    if (!title) {
      res.status(400).json({ error: 'Missing required field: title' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO tasks (tenant_id, title, description, status, priority, assignees, created_by, tags, due_date, parent_task)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        tenantId, title, description || '', status || 'inbox', priority || 'medium',
        assignees || [], userName, tags || [], due_date || null, parent_task || null,
      ]
    );

    const task = result.rows[0];

    await logActivity(tenantId, req.user!.userId, 'task_created', 'task', task.id, { title });

    if (assignees && assignees.length > 0) {
      for (const agentId of assignees) {
        await pool.query(
          `INSERT INTO notifications (tenant_id, recipient_id, recipient_type, type, source_task_id, message)
           VALUES ($1, $2, 'agent', 'assignment', $3, $4)`,
          [tenantId, agentId, task.id, `Assigned to task: ${title}`]
        );
      }
    }

    if (assignees && assignees.length > 0) {
      for (const assigneeId of assignees) {
        subscribeToThread(tenantId, task.id, assigneeId, 'agent').catch(() => {});
      }
    }
    subscribeToThread(tenantId, task.id, req.user!.userId, 'user').catch(() => {});

    try { await emitTaskEvent(tenantId, 'created', task); } catch (err) { console.error('Emit task created event error:', err); }
    fireWebhookEvent(tenantId, 'task.created', { task }).catch(() => {});

    res.status(201).json({ task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.get('/:id', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const taskId = req.params.id;

    const taskResult = await pool.query(
      `SELECT t.*,
              (SELECT json_agg(json_build_object('id', a.id, 'name', a.name))
               FROM agents a WHERE a.id = ANY(t.assignees) AND a.tenant_id = t.tenant_id
              ) as assignee_agents
       FROM tasks t WHERE t.id = $1 AND t.tenant_id = $2`,
      [taskId, tenantId]
    );

    if (taskResult.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const commentsResult = await pool.query(
      `SELECT c.*,
              COALESCE(ag.name, u.name, c.author_id) as author_name
       FROM comments c
       LEFT JOIN agents ag ON c.author_id = ag.id::text AND ag.tenant_id = c.tenant_id
       LEFT JOIN users u ON c.author_id = u.id::text AND u.tenant_id = c.tenant_id
       WHERE c.task_id = $1 AND c.tenant_id = $2
       ORDER BY c.created_at ASC`,
      [taskId, tenantId]
    );

    const activityResult = await pool.query(
      `SELECT a.*,
              COALESCE(ag.name, u.name, a.actor_id) as actor_name
       FROM activities a
       LEFT JOIN agents ag ON a.actor_id = ag.id::text AND ag.tenant_id = a.tenant_id
       LEFT JOIN users u ON a.actor_id = u.id::text AND u.tenant_id = a.tenant_id
       WHERE a.target_type = 'task' AND a.target_id = $1 AND a.tenant_id = $2
       ORDER BY a.created_at DESC`,
      [taskId, tenantId]
    );

    res.json({
      task: taskResult.rows[0],
      comments: commentsResult.rows,
      activities: activityResult.rows,
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

router.patch('/:id', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const taskId = req.params.id;

    const existingResult = await pool.query(
      `SELECT * FROM tasks WHERE id = $1 AND tenant_id = $2`,
      [taskId, tenantId]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const existing = existingResult.rows[0];
    const allowedFields = ['title', 'description', 'status', 'priority', 'assignees', 'tags', 'due_date', 'is_blocked', 'blocker_reason', 'blocked_by'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    updates.push(`updated_at = now()`);
    values.push(taskId, tenantId);

    const result = await pool.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      values
    );

    const task = result.rows[0];

    if (req.body.status && req.body.status !== existing.status) {
      await logActivity(tenantId, req.user!.userId, 'status_changed', 'task', taskId, {
        from: existing.status, to: req.body.status, title: task.title,
      });
    }

    if (req.body.assignees) {
      const newAssignees = (req.body.assignees as string[]).filter(
        (id: string) => !existing.assignees.includes(id)
      );
      for (const agentId of newAssignees) {
        await pool.query(
          `INSERT INTO notifications (tenant_id, recipient_id, recipient_type, type, source_task_id, message)
           VALUES ($1, $2, 'agent', 'assignment', $3, $4)`,
          [tenantId, agentId, taskId, `Assigned to task: ${task.title}`]
        );
      }
    }

    try { await emitTaskEvent(tenantId, 'updated', task); } catch (err) { console.error('Emit task updated event error:', err); }
    if (req.body.status === 'done' && req.body.status !== existing.status) {
      fireWebhookEvent(tenantId, 'task.completed', { task }).catch(() => {});
    }

    res.json({ task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.post('/:id/comments', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const taskId = req.params.id;
    const { content, mentions } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Missing required field: content' });
      return;
    }

    const taskCheck = await pool.query(
      `SELECT id, title FROM tasks WHERE id = $1 AND tenant_id = $2`,
      [taskId, tenantId]
    );

    if (taskCheck.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO comments (tenant_id, task_id, author_id, content, mentions)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, taskId, req.user!.userId, content, mentions || []]
    );

    const comment = result.rows[0];

    await logActivity(tenantId, req.user!.userId, 'comment_added', 'task', taskId, {
      comment_id: comment.id, title: taskCheck.rows[0].title,
    });

    await subscribeToThread(tenantId, taskId, req.user!.userId, 'user');

    notifyThreadSubscribers(tenantId, taskId, req.user!.userId, content, comment.id)
      .catch(err => console.error('Thread notification error:', err));

    parseMentionsAndNotify(tenantId, content, taskId, comment.id, req.user!.userId)
      .catch(err => console.error('Mention processing error:', err));

    try { await emitActivityEvent(tenantId, { action: 'comment_added', taskId, comment }); } catch (err) { console.error('Emit comment activity event error:', err); }

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.post('/:id/deliverables', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const tenantId = req.user!.tenantId;
    const taskId = req.params.id;

    const result = await saveDeliverable(
      tenantId, taskId, req.user!.userId, 'user',
      req.file.originalname, req.file.mimetype, req.file.buffer
    );
    res.status(201).json(result);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

router.get('/:id/deliverables', async (req: Request, res: Response) => {
  try {
    const deliverables = await getTaskDeliverables(req.user!.tenantId, req.params.id);
    res.json(deliverables);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load deliverables' });
  }
});

router.delete('/:id/deliverables/:deliverableId', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const deleted = await deleteDeliverable(req.user!.tenantId, req.params.deliverableId);
    if (!deleted) {
      res.status(404).json({ error: 'Deliverable not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete deliverable' });
  }
});

export default router;
