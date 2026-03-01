import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';

const router = Router();

router.post('/status', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;

    const result = await pool.query(
      `SELECT value FROM tenant_settings WHERE tenant_id = $1 AND key = 'setup_completed'`,
      [tenantId]
    );

    const setupCompleted = result.rows.length > 0 && result.rows[0].value === 'true';

    res.json({ setupCompleted });
  } catch (error) {
    console.error('Setup status error:', error);
    res.status(500).json({ error: 'Failed to get setup status' });
  }
});

router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;

    await pool.query(
      `INSERT INTO tenant_settings (tenant_id, key, value, updated_at)
       VALUES ($1, 'setup_completed', 'true', NOW())
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = 'true', updated_at = NOW()`,
      [tenantId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Setup complete error:', error);
    res.status(500).json({ error: 'Failed to mark setup as complete' });
  }
});

export default router;
