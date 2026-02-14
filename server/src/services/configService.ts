import crypto from 'crypto';
import { pool } from '../db/index.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'squidjob-dev-encryption-key-32b!';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export async function listProviders(tenantId: string) {
  const result = await pool.query(
    `SELECT id, provider, is_active, created_at FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return result.rows;
}

export async function connectProvider(tenantId: string, provider: string, apiKey: string) {
  const encryptedKey = encrypt(apiKey);
  const result = await pool.query(
    `INSERT INTO api_keys (tenant_id, provider, encrypted_key, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (tenant_id, provider) DO UPDATE SET encrypted_key = $3, is_active = true
     RETURNING id, provider, is_active, created_at`,
    [tenantId, provider, encryptedKey]
  );
  return result.rows[0];
}

export async function disconnectProvider(tenantId: string, providerId: string) {
  const result = await pool.query(
    `UPDATE api_keys SET is_active = false WHERE id = $1 AND tenant_id = $2 RETURNING id, provider, is_active`,
    [providerId, tenantId]
  );
  return result.rows[0] || null;
}

export async function getUsageStats(tenantId: string) {
  const result = await pool.query(
    `SELECT date, SUM(tokens_in)::int as tokens_in, SUM(tokens_out)::int as tokens_out,
            SUM(api_calls)::int as api_calls, SUM(estimated_cost)::numeric as estimated_cost
     FROM usage_records
     WHERE tenant_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY date ORDER BY date DESC`,
    [tenantId]
  );
  return result.rows;
}
