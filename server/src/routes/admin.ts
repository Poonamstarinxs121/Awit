import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { getCustomerInvoices } from '../services/stripeService.js';

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
        t.id, t.name, t.plan, t.status, t.subdomain, t.created_at,
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
      GROUP BY t.id, t.name, t.plan, t.status, t.subdomain, t.created_at, s.status, s.current_period_end, s.stripe_customer_id
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
      `SELECT t.*, s.plan as sub_plan, s.status as sub_status, s.current_period_end, s.stripe_customer_id, s.stripe_subscription_id
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
    res.json({ tenant: tenantResult.rows[0], usage: usageResult.rows[0] });
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

router.get('/finance', async (_req: Request, res: Response) => {
  try {
    const planPrices: Record<string, number> = { starter: 49, professional: 149, enterprise: 299 };

    const planResult = await pool.query(`
      SELECT plan, status, COUNT(*)::int as count
      FROM tenants
      GROUP BY plan, status
    `);

    const statusResult = await pool.query(`
      SELECT status, COUNT(*)::int as count FROM tenants GROUP BY status
    `);

    const planCounts: Record<string, number> = { starter: 0, professional: 0, enterprise: 0 };
    for (const row of planResult.rows) {
      planCounts[row.plan] = (planCounts[row.plan] || 0) + Number(row.count);
    }

    const statusCounts: Record<string, number> = {};
    for (const row of statusResult.rows) {
      statusCounts[row.status] = Number(row.count);
    }

    const mrr = Object.entries(planCounts).reduce((sum, [plan, count]) => {
      return sum + count * (planPrices[plan] || 0);
    }, 0);

    const monthlySignups = await pool.query(`
      SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*)::int as count
      FROM tenants
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);

    res.json({
      mrr,
      arr: mrr * 12,
      plan_counts: planCounts,
      active_count: statusCounts['active'] || 0,
      trial_count: statusCounts['trial'] || 0,
      suspended_count: statusCounts['suspended'] || 0,
      monthly_signups: monthlySignups.rows.reverse(),
    });
  } catch (error) {
    console.error('Admin finance error:', error);
    res.status(500).json({ error: 'Failed to get finance data' });
  }
});

router.get('/tenants/:id/invoices', async (req: Request, res: Response) => {
  try {
    const subResult = await pool.query(
      `SELECT stripe_customer_id FROM subscriptions WHERE tenant_id = $1`,
      [req.params.id]
    );
    if (subResult.rows.length === 0 || !subResult.rows[0].stripe_customer_id) {
      res.json({ invoices: [] });
      return;
    }
    const invoices = await getCustomerInvoices(subResult.rows[0].stripe_customer_id);
    res.json({ invoices });
  } catch (error) {
    console.error('Admin invoices error:', error);
    res.json({ invoices: [], error: 'Failed to fetch invoices from Stripe' });
  }
});

router.get('/tenants/:id/users', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, role, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/tenants', async (req: Request, res: Response) => {
  try {
    const { name, email, password, plan = 'starter', subdomain } = req.body;
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      res.status(400).json({ error: 'name, email, and password are required' });
      return;
    }
    const validPlans = ['starter', 'professional', 'enterprise'];
    if (!validPlans.includes(plan)) {
      res.status(400).json({ error: 'Invalid plan' });
      return;
    }

    const tenantResult = await pool.query(
      `INSERT INTO tenants (name, plan, subdomain) VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), plan, subdomain?.trim() || null]
    );
    const tenant = tenantResult.rows[0];

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (tenant_id, email, name, password_hash, role) VALUES ($1, $2, $3, $4, 'owner') RETURNING id, email, name, role, created_at`,
      [tenant.id, email.trim().toLowerCase(), name.trim(), passwordHash]
    );

    await pool.query(
      `INSERT INTO subscriptions (tenant_id, plan, status) VALUES ($1, $2, 'active') ON CONFLICT (tenant_id) DO NOTHING`,
      [tenant.id, plan]
    );

    res.status(201).json({ tenant, user: userResult.rows[0] });
  } catch (error: any) {
    console.error('Admin create tenant error:', error);
    if (error.code === '23505') {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

router.patch('/tenants/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'suspended', 'trial'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be active, suspended, or trial.' });
      return;
    }
    await pool.query(`UPDATE tenants SET status = $1 WHERE id = $2`, [status, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.delete('/tenants/:id', async (req: Request, res: Response) => {
  try {
    const tenantResult = await pool.query(`SELECT status FROM tenants WHERE id = $1`, [req.params.id]);
    if (tenantResult.rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    if (tenantResult.rows[0].status !== 'suspended') {
      res.status(400).json({ error: 'Tenant must be suspended before deletion. Update status to "suspended" first.' });
      return;
    }
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete tenant error:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

export default router;
