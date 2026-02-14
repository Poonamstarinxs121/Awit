import { pool } from '../db/index.js';
import type { PoolClient } from 'pg';

const DEFAULT_MODEL_CONFIG = { provider: 'openai', model: 'gpt-4o', temperature: 0.7 };

const DEFAULT_AGENTS = [
  {
    name: 'Oracle',
    role: 'Squad lead, task triage, delegation, coordination',
    soul_md: 'I am Oracle, the Squad Lead. I see the big picture, triage incoming work, and ensure every task reaches the right agent. I am strategic, decisive, and accountability-driven. I believe in clear delegation and measurable outcomes.',
    level: 'lead',
  },
  {
    name: 'Strategist',
    role: 'Product strategy, UX review, edge case analysis',
    soul_md: 'I am the Strategist. I think deeply about product direction, user experience, and edge cases others miss. I am skeptical, detail-oriented, and thorough. I challenge assumptions to strengthen outcomes.',
    level: 'specialist',
  },
  {
    name: 'Scribe',
    role: 'Content creation, copywriting, documentation',
    soul_md: 'I am the Scribe. I craft clear, compelling content and documentation. I am creative, concise, and brand-aware. Every word I write serves a purpose.',
    level: 'specialist',
  },
  {
    name: 'Forge',
    role: 'Code generation, technical implementation',
    soul_md: 'I am Forge. I build robust, clean code and technical solutions. I am pragmatic and advocate for simplicity. I write code that others can read and maintain.',
    level: 'specialist',
  },
  {
    name: 'Detective',
    role: 'Deep research, competitive analysis, market intel',
    soul_md: 'I am the Detective. I dig deep into research, competitive analysis, and market intelligence. I am curious, methodical, and always cite my sources.',
    level: 'specialist',
  },
];

export async function seedDefaultAgents(tenantId: string, client?: PoolClient): Promise<void> {
  const db = client || pool;
  for (const agent of DEFAULT_AGENTS) {
    await db.query(
      `INSERT INTO agents (tenant_id, name, role, soul_md, agents_md, tools_md, heartbeat_md, model_config, level, status, is_default)
       VALUES ($1, $2, $3, $4, '', '', '', $5, $6, 'active', true)`,
      [tenantId, agent.name, agent.role, agent.soul_md, JSON.stringify(DEFAULT_MODEL_CONFIG), agent.level]
    );
  }
}

export async function listAgents(tenantId: string) {
  const result = await pool.query(
    `SELECT id, name, role, status, level, is_default, model_config, created_at
     FROM agents WHERE tenant_id = $1 ORDER BY created_at ASC`,
    [tenantId]
  );
  return result.rows;
}

export async function createAgent(tenantId: string, data: {
  name: string; role: string; soul_md?: string; agents_md?: string;
  tools_md?: string; heartbeat_md?: string; model_config?: Record<string, unknown>; level?: string;
}) {
  const result = await pool.query(
    `INSERT INTO agents (tenant_id, name, role, soul_md, agents_md, tools_md, heartbeat_md, model_config, level, status, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', false)
     RETURNING *`,
    [
      tenantId, data.name, data.role,
      data.soul_md || '', data.agents_md || '', data.tools_md || '', data.heartbeat_md || '',
      JSON.stringify(data.model_config || DEFAULT_MODEL_CONFIG),
      data.level || 'specialist',
    ]
  );
  return result.rows[0];
}

export async function getAgent(tenantId: string, agentId: string) {
  const result = await pool.query(
    `SELECT * FROM agents WHERE id = $1 AND tenant_id = $2`,
    [agentId, tenantId]
  );
  return result.rows[0] || null;
}

export async function updateAgent(tenantId: string, agentId: string, data: Record<string, unknown>) {
  const allowedFields = ['name', 'role', 'soul_md', 'agents_md', 'tools_md', 'heartbeat_md', 'model_config', 'level', 'status'];
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      if (field === 'model_config') {
        updates.push(`${field} = $${paramIndex}`);
        values.push(JSON.stringify(data[field]));
      } else {
        updates.push(`${field} = $${paramIndex}`);
        values.push(data[field]);
      }
      paramIndex++;
    }
  }

  if (updates.length === 0) return null;

  values.push(agentId, tenantId);
  const result = await pool.query(
    `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function getAgentStats(tenantId: string, agentId: string) {
  const result = await pool.query(
    `SELECT t.status, COUNT(*)::int as count
     FROM tasks t
     WHERE t.tenant_id = $1 AND $2 = ANY(t.assignees)
     GROUP BY t.status`,
    [tenantId, agentId]
  );

  const completedResult = await pool.query(
    `SELECT COUNT(*)::int as total_completed
     FROM tasks WHERE tenant_id = $1 AND $2 = ANY(assignees) AND status = 'done'`,
    [tenantId, agentId]
  );

  return {
    by_status: result.rows,
    total_completed: completedResult.rows[0]?.total_completed || 0,
  };
}
