import { Router, Request, Response } from 'express';
import os from 'os';
import { pool } from '../db/index.js';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg();
    const uptimeSeconds = os.uptime();

    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptime = `${days}d ${hours}h`;

    const cpuUsage = Math.min(100, Math.round((loadAvg[0] / cpus.length) * 100));

    const tenantId = req.user!.tenantId;
    const agentResult = await pool.query(
      "SELECT COUNT(*) as total, COUNT(CASE WHEN status IN ('active','idle') THEN 1 END) as online FROM agents WHERE tenant_id = $1",
      [tenantId]
    );
    const taskResult = await pool.query(
      "SELECT COUNT(*) as active FROM tasks WHERE tenant_id = $1 AND status NOT IN ('done', 'cancelled')",
      [tenantId]
    );
    const cronResult = await pool.query(
      "SELECT COUNT(*) as total FROM cron_jobs WHERE tenant_id = $1 AND is_active = true",
      [tenantId]
    );

    const agents = agentResult.rows[0];
    const tasks = taskResult.rows[0];
    const cron = cronResult.rows[0];

    res.json({
      cpu: cpuUsage,
      ram: {
        used: Math.round(usedMem / 1024 / 1024 / 1024 * 10) / 10,
        total: Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10,
      },
      disk: { used: 0, total: 0 },
      uptime,
      loadAvg,
      agents: {
        total: parseInt(agents.total),
        online: parseInt(agents.online),
      },
      tasks: {
        active: parseInt(tasks.active),
      },
      cronJobs: {
        total: parseInt(cron.total),
      },
      vpnActive: false,
      firewallActive: true,
      activeServices: 2,
      totalServices: 2,
    });
  } catch (error) {
    console.error('System stats error:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

router.get('/services', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const agentResult = await pool.query(
      "SELECT COUNT(*) as total, COUNT(CASE WHEN status IN ('active','idle') THEN 1 END) as online FROM agents WHERE tenant_id = $1",
      [tenantId]
    );
    const agents = agentResult.rows[0];

    let dbOk = false;
    try {
      await pool.query('SELECT 1');
      dbOk = true;
    } catch {}

    res.json({
      services: [
        {
          name: 'squidjob-server',
          label: 'SquidJob API Server',
          status: 'active',
          description: 'Express API + WebSocket server',
          pid: process.pid,
          mem: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          uptime: Math.floor(process.uptime()),
          restarts: 0,
        },
        {
          name: 'postgresql',
          label: 'PostgreSQL Database',
          status: dbOk ? 'active' : 'failed',
          description: 'Multi-tenant PostgreSQL database',
          pid: null,
          mem: null,
          uptime: null,
          restarts: 0,
        },
        {
          name: 'agent-orchestrator',
          label: 'Agent Orchestration Engine',
          status: parseInt(agents.online) > 0 ? 'active' : 'inactive',
          description: `${agents.online}/${agents.total} agents active`,
          pid: null,
          mem: null,
          uptime: null,
          restarts: 0,
        },
      ],
    });
  } catch (error) {
    console.error('Services error:', error);
    res.status(500).json({ error: 'Failed to get services' });
  }
});

router.get('/monitor', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = async () => {
    try {
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const loadAvg = os.loadavg();
      const cpuUsage = Math.min(100, Math.round((loadAvg[0] / cpus.length) * 100));

      const data = {
        cpu: cpuUsage,
        ram: {
          used: Math.round(usedMem / 1024 / 1024 / 1024 * 10) / 10,
          total: Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10,
        },
        timestamp: Date.now(),
      };

      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {}
  };

  send();
  const interval = setInterval(send, 5000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

export default router;
