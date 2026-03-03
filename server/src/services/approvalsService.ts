import { pool } from '../db/index.js';

export interface ApprovalRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  action_type: string;
  payload: Record<string, unknown> | null;
  requested_by_agent_id: string | null;
  requested_by_agent_name?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewed_by: string | null;
  reviewed_at: string | null;
  expires_at: string;
  created_at: string;
}

export async function createApproval(
  tenantId: string,
  data: {
    title: string;
    description?: string;
    action_type: string;
    payload?: Record<string, unknown>;
    requested_by_agent_id?: string;
  }
): Promise<ApprovalRow> {
  const result = await pool.query(
    `INSERT INTO approvals (tenant_id, title, description, action_type, payload, requested_by_agent_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      tenantId,
      data.title,
      data.description ?? null,
      data.action_type,
      data.payload ? JSON.stringify(data.payload) : null,
      data.requested_by_agent_id ?? null,
    ]
  );
  return result.rows[0];
}

export async function getApprovals(
  tenantId: string,
  status?: string
): Promise<ApprovalRow[]> {
  const conditions = ['ap.tenant_id = $1'];
  const values: unknown[] = [tenantId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`ap.status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  const result = await pool.query(
    `SELECT ap.*, ag.name as requested_by_agent_name
     FROM approvals ap
     LEFT JOIN agents ag ON ap.requested_by_agent_id = ag.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ap.created_at DESC`,
    values
  );
  return result.rows;
}

export async function getPendingCount(tenantId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int as count FROM approvals WHERE tenant_id = $1 AND status = 'pending'`,
    [tenantId]
  );
  return result.rows[0].count;
}

export async function reviewApproval(
  tenantId: string,
  id: string,
  userId: string,
  decision: 'approved' | 'rejected'
): Promise<ApprovalRow | null> {
  const result = await pool.query(
    `UPDATE approvals
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3 AND tenant_id = $4 AND status = 'pending'
     RETURNING *`,
    [decision, userId, id, tenantId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function expireOldApprovals(): Promise<void> {
  try {
    await pool.query(
      `UPDATE approvals SET status = 'expired'
       WHERE status = 'pending' AND expires_at < NOW()`
    );
  } catch (err) {
    console.error('Expire approvals error:', err);
  }
}

setInterval(expireOldApprovals, 5 * 60 * 1000);
