import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';

const router = Router();

async function getActivityStats(tenantId: string) {
  const [totalRes, todayRes, byTypeRes, byStatusRes, byDayRes, byHourRes] = await Promise.all([
    pool.query('SELECT COUNT(*) as total FROM activity_log WHERE tenant_id = $1', [tenantId]),
    pool.query(
      "SELECT COUNT(*) as today FROM activity_log WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '1 day'",
      [tenantId]
    ),
    pool.query(
      'SELECT action as type, COUNT(*) as count FROM activity_log WHERE tenant_id = $1 GROUP BY action ORDER BY count DESC LIMIT 10',
      [tenantId]
    ),
    pool.query(
      "SELECT COUNT(*) as success FROM activity_log WHERE tenant_id = $1 AND details::text NOT ILIKE '%error%'",
      [tenantId]
    ),
    pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM activity_log
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [tenantId]
    ),
    pool.query(
      `SELECT EXTRACT(HOUR FROM created_at)::int as hour,
              EXTRACT(DOW FROM created_at)::int as day,
              COUNT(*)::int as count
       FROM activity_log
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY hour, day`,
      [tenantId]
    ),
  ]);

  const total = parseInt(totalRes.rows[0].total);
  const today = parseInt(todayRes.rows[0].today);
  const success = parseInt(byStatusRes.rows[0].success);
  const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

  return {
    total,
    today,
    success,
    error: total - success,
    successRate,
    byType: byTypeRes.rows.map((r: any) => ({ type: r.type || 'other', count: parseInt(r.count) })),
    byStatus: { success, error: total - success },
    byDay: byDayRes.rows.map((r: any) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date,
      count: parseInt(r.count),
    })),
    byHour: byHourRes.rows.map((r: any) => ({
      hour: r.hour,
      day: r.day,
      count: r.count,
    })),
  };
}

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getActivityStats(req.user!.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Activity stats error:', error);
    res.status(500).json({ error: 'Failed to get activity stats' });
  }
});

router.get('/stream', (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let lastId = 0;

  const poll = async () => {
    try {
      const result = await pool.query(
        'SELECT id, action, agent_id, created_at FROM activity_log WHERE tenant_id = $1 AND id > $2 ORDER BY id ASC LIMIT 20',
        [tenantId, lastId]
      );
      for (const row of result.rows) {
        lastId = row.id;
        res.write(`data: ${JSON.stringify(row)}\n\n`);
      }
    } catch {}
  };

  poll();
  const interval = setInterval(poll, 2000);
  req.on('close', () => { clearInterval(interval); res.end(); });
});

export default router;
