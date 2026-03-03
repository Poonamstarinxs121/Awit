import { Router, Request, Response } from 'express';
import { listActivities } from '../services/activityService.js';
import { pool } from '../db/index.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit, offset, agent_id, action, type } = req.query;

    const activities = await listActivities(req.user!.tenantId, {
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
      agent_id: agent_id as string | undefined,
      action: (action || type) as string | undefined,
    });

    res.json({ activities });
  } catch (error) {
    console.error('List activities error:', error);
    res.status(500).json({ error: 'Failed to list activities' });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const [totalRes, todayRes, byTypeRes, byDayRes, byHourRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM activities WHERE tenant_id = $1', [tenantId]),
      pool.query(
        "SELECT COUNT(*) as today FROM activities WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '1 day'",
        [tenantId]
      ),
      pool.query(
        'SELECT action as type, COUNT(*) as count FROM activities WHERE tenant_id = $1 GROUP BY action ORDER BY count DESC LIMIT 10',
        [tenantId]
      ),
      pool.query(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM activities
         WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [tenantId]
      ),
      pool.query(
        `SELECT EXTRACT(HOUR FROM created_at)::int as hour,
                EXTRACT(DOW FROM created_at)::int as day,
                COUNT(*)::int as count
         FROM activities
         WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY hour, day`,
        [tenantId]
      ),
    ]);

    const total = parseInt(totalRes.rows[0].total);
    const today = parseInt(todayRes.rows[0].today);
    const success = total;

    res.json({
      total,
      today,
      success,
      error: 0,
      successRate: 100,
      byType: byTypeRes.rows.map((r: any) => ({ type: r.type || 'other', count: parseInt(r.count) })),
      byStatus: { success: total, error: 0 },
      byDay: byDayRes.rows.map((r: any) => ({
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
        count: parseInt(r.count),
      })),
      byHour: byHourRes.rows.map((r: any) => ({
        hour: r.hour,
        day: r.day,
        count: r.count,
      })),
    });
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

  let lastTs = new Date().toISOString();

  const poll = async () => {
    try {
      const result = await pool.query(
        'SELECT id, action, actor_id, metadata, created_at FROM activities WHERE tenant_id = $1 AND created_at > $2 ORDER BY created_at ASC LIMIT 20',
        [tenantId, lastTs]
      );
      for (const row of result.rows) {
        lastTs = row.created_at;
        res.write(`data: ${JSON.stringify({ id: row.id, action: row.action, agent_id: row.actor_id, details: row.metadata, created_at: row.created_at })}\n\n`);
      }
    } catch {}
  };

  poll();
  const interval = setInterval(poll, 2000);
  req.on('close', () => { clearInterval(interval); res.end(); });
});

export default router;
