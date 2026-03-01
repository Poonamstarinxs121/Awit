import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/index.js';
import { JWT_SECRET, authMiddleware } from '../middleware/auth.js';
import { seedDefaultAgents } from '../services/agentService.js';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, companyName } = req.body;

    if (!email || !password || !name || !companyName) {
      res.status(400).json({ error: 'Missing required fields: email, password, name, companyName' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const tenantResult = await client.query(
        `INSERT INTO tenants (name, plan) VALUES ($1, 'starter') RETURNING id`,
        [companyName]
      );
      const tenantId = tenantResult.rows[0].id;

      const passwordHash = await bcrypt.hash(password, 10);

      const userResult = await client.query(
        `INSERT INTO users (tenant_id, email, name, password_hash, role, is_saas_admin) VALUES ($1, $2, $3, $4, 'owner', false) RETURNING id, role, is_saas_admin`,
        [tenantId, email, name, passwordHash]
      );
      const user = userResult.rows[0];

      await seedDefaultAgents(tenantId, client);

      await client.query('COMMIT');

      const token = jwt.sign(
        { userId: user.id, tenantId, email, name, role: user.role, isSaasAdmin: user.is_saas_admin },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({ token, userId: user.id, tenantId, role: user.role });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505') {
      res.status(409).json({ error: 'Email already registered for this tenant' });
      return;
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Missing required fields: email, password' });
      return;
    }

    const result = await pool.query(
      `SELECT id, tenant_id, email, name, password_hash, role, is_saas_admin FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, email: user.email, name: user.name, role: user.role, isSaasAdmin: user.is_saas_admin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, userId: user.id, tenantId: user.tenant_id, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, tenantId } = req.user!;

    const userResult = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.created_at, u.is_saas_admin, t.name as tenant_name
       FROM users u JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1 AND u.tenant_id = $2`,
      [userId, tenantId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];

    const settingsResult = await pool.query(
      `SELECT value FROM tenant_settings WHERE tenant_id = $1 AND key = 'setup_completed'`,
      [tenantId]
    );
    const setupCompleted = settingsResult.rows.length > 0 && settingsResult.rows[0].value === 'true';

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId,
        tenantName: user.tenant_name,
        createdAt: user.created_at,
        isSaasAdmin: user.is_saas_admin,
        setupCompleted,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

router.post('/token', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Missing refresh token' });
      return;
    }
    res.status(501).json({ error: 'Token refresh not yet implemented' });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

export default router;
