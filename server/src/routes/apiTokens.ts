import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { requireMinRole } from '../middleware/rbac.js';
import crypto from 'crypto';

const router = Router();

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

router.get('/', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name, last_used_at, expires_at, created_at
       FROM api_tokens
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [req.user!.tenantId, req.user!.userId]
    );
    res.json({ tokens: result.rows });
  } catch (error) {
    console.error('List API tokens error:', error);
    res.status(500).json({ error: 'Failed to list API tokens' });
  }
});

router.post('/', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { name, expires_in_days } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const rawToken = `sqj_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = hashToken(rawToken);

    const expiresAt = expires_in_days
      ? new Date(Date.now() + parseInt(expires_in_days) * 86400000).toISOString()
      : null;

    const result = await pool.query(
      `INSERT INTO api_tokens (tenant_id, user_id, name, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, expires_at, created_at`,
      [req.user!.tenantId, req.user!.userId, name.trim(), tokenHash, expiresAt]
    );

    res.status(201).json({
      token: result.rows[0],
      raw_token: rawToken,
    });
  } catch (error) {
    console.error('Create API token error:', error);
    res.status(500).json({ error: 'Failed to create API token' });
  }
});

router.delete('/:id', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `DELETE FROM api_tokens WHERE id = $1 AND tenant_id = $2 AND user_id = $3 RETURNING id`,
      [req.params.id, req.user!.tenantId, req.user!.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Token not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete API token error:', error);
    res.status(500).json({ error: 'Failed to delete API token' });
  }
});

export { hashToken };
export default router;
