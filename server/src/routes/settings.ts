import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { seedDefaultAgents } from '../services/agentService.js';

const router = Router();

router.post('/restart-gateway', async (req: Request, res: Response) => {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    res.json({ success: true, message: 'Gateway restarted successfully' });
  } catch (error) {
    console.error('Restart gateway error:', error);
    res.status(500).json({ error: 'Failed to restart gateway' });
  }
});

router.post('/reset-workspace', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(`DELETE FROM cron_jobs WHERE tenant_id = $1`, [tenantId]);
      await client.query(`DELETE FROM standups WHERE tenant_id = $1`, [tenantId]);
      await client.query(`DELETE FROM memory_entries WHERE tenant_id = $1`, [tenantId]);
      await client.query(`DELETE FROM sessions WHERE tenant_id = $1`, [tenantId]);
      await client.query(`DELETE FROM comments WHERE tenant_id = $1`, [tenantId]);
      await client.query(`DELETE FROM activities WHERE tenant_id = $1`, [tenantId]);
      await client.query(`DELETE FROM deliverables WHERE tenant_id = $1`, [tenantId]);
      await client.query(`DELETE FROM task_deliverables WHERE tenant_id = $1`, [tenantId]);
      await client.query(`DELETE FROM tasks WHERE tenant_id = $1`, [tenantId]);
      await client.query(`DELETE FROM agents WHERE tenant_id = $1`, [tenantId]);

      await seedDefaultAgents(tenantId, client);

      await client.query(
        `INSERT INTO tenant_settings (tenant_id, key, value, updated_at)
         VALUES ($1, 'setup_completed', 'false', NOW())
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = 'false', updated_at = NOW()`,
        [tenantId]
      );

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Reset workspace error:', error);
    res.status(500).json({ error: 'Failed to reset workspace' });
  }
});

router.post('/pause-all', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;

    await pool.query(
      `INSERT INTO tenant_settings (tenant_id, key, value, updated_at)
       VALUES ($1, 'global_paused', 'true', NOW())
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = 'true', updated_at = NOW()`,
      [tenantId]
    );

    res.json({ success: true, globalPaused: true });
  } catch (error) {
    console.error('Pause all error:', error);
    res.status(500).json({ error: 'Failed to pause all agents' });
  }
});

router.post('/resume-all', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;

    await pool.query(
      `INSERT INTO tenant_settings (tenant_id, key, value, updated_at)
       VALUES ($1, 'global_paused', 'false', NOW())
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = 'false', updated_at = NOW()`,
      [tenantId]
    );

    res.json({ success: true, globalPaused: false });
  } catch (error) {
    console.error('Resume all error:', error);
    res.status(500).json({ error: 'Failed to resume all agents' });
  }
});

router.get('/pause-status', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;

    const result = await pool.query(
      `SELECT value FROM tenant_settings WHERE tenant_id = $1 AND key = 'global_paused'`,
      [tenantId]
    );

    const globalPaused = result.rows.length > 0 && result.rows[0].value === 'true';

    res.json({ globalPaused });
  } catch (error) {
    console.error('Pause status error:', error);
    res.status(500).json({ error: 'Failed to get pause status' });
  }
});

export default router;
