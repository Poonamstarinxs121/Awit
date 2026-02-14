import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { requireMinRole } from '../middleware/rbac.js';
import { parseNextRun } from '../services/cronScheduler.js';
import { executeAgentTurn } from '../services/orchestrationEngine.js';
import { logActivity } from '../services/activityService.js';

const router = Router();

router.get('/', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const result = await pool.query(
      `SELECT * FROM cron_jobs WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing cron jobs:', error);
    res.status(500).json({ error: 'Failed to list cron jobs' });
  }
});

router.post('/', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { agent_id, name, schedule, schedule_type, execution_mode, command, model_override } = req.body;

    if (!agent_id || !name || !schedule || !schedule_type || !execution_mode || !command) {
      res.status(400).json({ error: 'Missing required fields: agent_id, name, schedule, schedule_type, execution_mode, command' });
      return;
    }

    if (!['cron', 'at', 'interval'].includes(schedule_type)) {
      res.status(400).json({ error: 'schedule_type must be one of: cron, at, interval' });
      return;
    }

    if (!['main_session', 'isolated'].includes(execution_mode)) {
      res.status(400).json({ error: 'execution_mode must be one of: main_session, isolated' });
      return;
    }

    let nextRunAt: Date;
    try {
      nextRunAt = parseNextRun(schedule, schedule_type);
    } catch (err) {
      res.status(400).json({ error: `Invalid schedule: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    const result = await pool.query(
      `INSERT INTO cron_jobs (tenant_id, agent_id, name, schedule, schedule_type, execution_mode, command, model_override, is_active, next_run_at, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, 0)
       RETURNING *`,
      [tenantId, agent_id, name, schedule, schedule_type, execution_mode, command, model_override || null, nextRunAt.toISOString()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating cron job:', error);
    res.status(500).json({ error: 'Failed to create cron job' });
  }
});

router.patch('/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const existing = await pool.query(
      `SELECT * FROM cron_jobs WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Cron job not found' });
      return;
    }

    const job = existing.rows[0];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'schedule', 'schedule_type', 'execution_mode', 'command', 'model_override', 'is_active', 'agent_id'];

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

    const newSchedule = req.body.schedule || job.schedule;
    const newScheduleType = req.body.schedule_type || job.schedule_type;

    if (req.body.schedule || req.body.schedule_type) {
      try {
        const nextRunAt = parseNextRun(newSchedule, newScheduleType);
        updates.push(`next_run_at = $${paramIndex}`);
        values.push(nextRunAt.toISOString());
        paramIndex++;
      } catch (err) {
        res.status(400).json({ error: `Invalid schedule: ${err instanceof Error ? err.message : String(err)}` });
        return;
      }
    }

    if (req.body.is_active === true) {
      updates.push(`retry_count = 0`);
    }

    values.push(id, tenantId);

    const result = await pool.query(
      `UPDATE cron_jobs SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating cron job:', error);
    res.status(500).json({ error: 'Failed to update cron job' });
  }
});

router.delete('/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM cron_jobs WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Cron job not found' });
      return;
    }

    res.json({ message: 'Cron job deleted' });
  } catch (error) {
    console.error('Error deleting cron job:', error);
    res.status(500).json({ error: 'Failed to delete cron job' });
  }
});

router.post('/:id/trigger', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM cron_jobs WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Cron job not found' });
      return;
    }

    const job = result.rows[0];

    const sessionKey = job.execution_mode === 'isolated'
      ? `cron-${job.id}-${Date.now()}`
      : undefined;

    const turnResult = await executeAgentTurn(
      job.tenant_id,
      job.agent_id,
      job.command,
      sessionKey
    );

    await logActivity(
      job.tenant_id,
      job.agent_id,
      'cron_execution',
      'cron_job',
      job.id,
      {
        name: job.name,
        mode: job.execution_mode,
        status: 'manual_trigger',
        response_preview: turnResult.response.slice(0, 200),
        tokens_used: turnResult.tokensIn + turnResult.tokensOut,
      }
    );

    await pool.query(
      `UPDATE cron_jobs SET last_run_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Cron job triggered', response_preview: turnResult.response.slice(0, 500) });
  } catch (error) {
    console.error('Error triggering cron job:', error);
    res.status(500).json({ error: `Failed to trigger cron job: ${error instanceof Error ? error.message : String(error)}` });
  }
});

export default router;
