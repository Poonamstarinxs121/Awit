import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM standups WHERE tenant_id = $1 ORDER BY date DESC LIMIT 30`,
      [req.user!.tenantId]
    );
    res.json({ standups: result.rows });
  } catch (error) {
    console.error('List standups error:', error);
    res.status(500).json({ error: 'Failed to list standups' });
  }
});

router.get('/latest', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM standups WHERE tenant_id = $1 ORDER BY date DESC LIMIT 1`,
      [req.user!.tenantId]
    );
    res.json({ standup: result.rows[0] || null });
  } catch (error) {
    console.error('Get latest standup error:', error);
    res.status(500).json({ error: 'Failed to get latest standup' });
  }
});

export default router;
