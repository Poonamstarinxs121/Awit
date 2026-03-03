import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function requireSaasAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isSaasAdmin) {
    res.status(403).json({ error: 'SaaS admin access required' });
    return;
  }
  next();
}

router.use(authMiddleware, requireSaasAdmin);

router.get('/tenants', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.plan, t.created_at,
        COUNT(DISTINCT u.id)::int as user_count,
        COUNT(DISTINCT a.id)::int as agent_count,
        COUNT(DISTINCT tk.id)::int as task_count,
        MAX(act.created_at) as last_active_at,
        s.status as sub_status,
        s.current_period_end,
        s.stripe_customer_id
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id
      LEFT JOIN agents a ON a.tenant_id = t.id
      LEFT JOIN tasks tk ON tk.tenant_id = t.id
      LEFT JOIN activities act ON act.tenant_id = t.id
      LEFT JOIN subscriptions s ON s.tenant_id = t.id
      GROUP BY t.id, t.name, t.plan, t.created_at, s.status, s.current_period_end, s.stripe_customer_id
      ORDER BY t.created_at DESC
    `);

    res.json({ tenants: result.rows });
  } catch (error) {
    console.error('Admin list tenants error:', error);
    res.status(500).json({ error: 'Failed to list tenants' });
  }
});

router.get('/tenants/:id', async (req: Request, res: Response) => {
  try {
    const tenantResult = await pool.query(
      `SELECT t.*, s.plan as sub_plan, s.status as sub_status, s.current_period_end, s.stripe_customer_id
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (tenantResult.rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const usageResult = await pool.query(
      `SELECT
         COUNT(DISTINCT u.id)::int as user_count,
         COUNT(DISTINCT a.id)::int as agent_count,
         COUNT(DISTINCT tk.id)::int as task_count,
         COALESCE(SUM(ur.tokens_in + ur.tokens_out), 0)::bigint as total_tokens,
         COALESCE(SUM(ur.estimated_cost)::numeric, 0) as total_cost
       FROM tenants t
       LEFT JOIN users u ON u.tenant_id = t.id
       LEFT JOIN agents a ON a.tenant_id = t.id
       LEFT JOIN tasks tk ON tk.tenant_id = t.id
       LEFT JOIN usage_records ur ON ur.tenant_id = t.id
       WHERE t.id = $1`,
      [req.params.id]
    );

    res.json({
      tenant: tenantResult.rows[0],
      usage: usageResult.rows[0],
    });
  } catch (error) {
    console.error('Admin get tenant error:', error);
    res.status(500).json({ error: 'Failed to get tenant' });
  }
});

router.patch('/tenants/:id/plan', async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;
    const validPlans = ['starter', 'professional', 'enterprise'];
    if (!validPlans.includes(plan)) {
      res.status(400).json({ error: 'Invalid plan' });
      return;
    }

    await pool.query(`UPDATE tenants SET plan = $1 WHERE id = $2`, [plan, req.params.id]);
    await pool.query(
      `INSERT INTO subscriptions (tenant_id, plan, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (tenant_id) DO UPDATE SET plan = EXCLUDED.plan, updated_at = NOW()`,
      [req.params.id, plan]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Admin update plan error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

router.get('/usage', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id as tenant_id, t.name as tenant_name, t.plan,
        COALESCE(SUM(ur.tokens_in + ur.tokens_out), 0)::bigint as total_tokens,
        COALESCE(SUM(ur.api_calls), 0)::int as total_calls,
        COALESCE(SUM(ur.estimated_cost)::numeric, 0) as total_cost,
        COUNT(DISTINCT ur.date) as active_days
      FROM tenants t
      LEFT JOIN usage_records ur ON ur.tenant_id = t.id
      GROUP BY t.id, t.name, t.plan
      ORDER BY total_cost DESC
    `);

    const totals = await pool.query(`
      SELECT
        COUNT(DISTINCT t.id)::int as tenant_count,
        COUNT(DISTINCT u.id)::int as user_count,
        COUNT(DISTINCT a.id)::int as agent_count,
        COALESCE(SUM(ur.estimated_cost)::numeric, 0) as total_revenue_proxy
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id
      LEFT JOIN agents a ON a.tenant_id = t.id
      LEFT JOIN usage_records ur ON ur.tenant_id = t.id
    `);

    res.json({ by_tenant: result.rows, totals: totals.rows[0] });
  } catch (error) {
    console.error('Admin usage error:', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

export default router;
