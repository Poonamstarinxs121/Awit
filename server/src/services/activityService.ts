import { pool } from '../db/index.js';

export async function logActivity(
  tenantId: string,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO activities (tenant_id, actor_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, actorId, action, targetType, targetId, JSON.stringify(metadata)]
  );
}

export async function listActivities(
  tenantId: string,
  options: { limit?: number; offset?: number; agent_id?: string; action?: string }
) {
  const conditions = ['a.tenant_id = $1'];
  const values: unknown[] = [tenantId];
  let paramIndex = 2;

  if (options.agent_id) {
    conditions.push(`a.actor_id = $${paramIndex}`);
    values.push(options.agent_id);
    paramIndex++;
  }

  if (options.action) {
    conditions.push(`a.action = $${paramIndex}`);
    values.push(options.action);
    paramIndex++;
  }

  const limit = options.limit || 50;
  const offset = options.offset || 0;

  values.push(limit, offset);

  const result = await pool.query(
    `SELECT a.*, 
            COALESCE(ag.name, u.name, a.actor_id) as actor_name
     FROM activities a
     LEFT JOIN agents ag ON a.actor_id = ag.id::text AND ag.tenant_id = a.tenant_id
     LEFT JOIN users u ON a.actor_id = u.id::text AND u.tenant_id = a.tenant_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values
  );
  return result.rows;
}
