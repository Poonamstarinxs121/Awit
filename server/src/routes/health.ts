import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch {}

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: dbOk ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime()),
    version: '1.0.0',
  });
});

export default router;
