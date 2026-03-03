import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db/index.js';
import type { JwtPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'squidjob-dev-secret-change-in-production';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  if (token.startsWith('sqj_')) {
    try {
      const tokenHash = hashToken(token);
      const result = await pool.query(
        `SELECT at.*, u.role, u.email, u.name, t.name as tenant_name, t.plan
         FROM api_tokens at
         JOIN users u ON at.user_id = u.id
         JOIN tenants t ON at.tenant_id = t.id
         WHERE at.token_hash = $1
           AND (at.expires_at IS NULL OR at.expires_at > NOW())`,
        [tokenHash]
      );
      if (result.rows.length === 0) {
        res.status(401).json({ error: 'Invalid or expired API token' });
        return;
      }
      const row = result.rows[0];
      await pool.query(`UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1`, [row.id]);
      req.user = {
        userId: row.user_id,
        tenantId: row.tenant_id,
        email: row.email,
        name: row.name,
        role: row.role,
      } as JwtPayload;
      next();
      return;
    } catch (err) {
      console.error('API token auth error:', err);
      res.status(500).json({ error: 'Authentication error' });
      return;
    }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export { JWT_SECRET };
