import { pool } from '../db/index.js';
import { executeAgentTurn } from './orchestrationEngine.js';
import { logActivity } from './activityService.js';

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

interface HeartbeatAgent {
  id: string;
  tenant_id: string;
  name: string;
  heartbeat_md: string;
  model_config: Record<string, unknown>;
}

async function getHeartbeatAgents(): Promise<HeartbeatAgent[]> {
  const result = await pool.query(
    `SELECT a.id, a.tenant_id, a.name, a.heartbeat_md, a.model_config
     FROM agents a
     INNER JOIN api_keys ak ON a.tenant_id = ak.tenant_id AND ak.is_active = true
     WHERE a.status = 'active' AND a.heartbeat_md != '' AND a.heartbeat_md IS NOT NULL
     GROUP BY a.id, a.tenant_id, a.name, a.heartbeat_md, a.model_config`
  );
  return result.rows;
}

async function runAgentHeartbeat(agent: HeartbeatAgent): Promise<void> {
  const heartbeatPrompt = `HEARTBEAT CHECK - Review your heartbeat checklist and take action on anything that needs attention.

Your Heartbeat Checklist:
${agent.heartbeat_md}

Instructions:
- Go through each item in your checklist
- If something needs attention, describe what action you'd take
- If everything looks good, respond with HEARTBEAT_OK
- Be concise and action-oriented`;

  try {
    const result = await executeAgentTurn(
      agent.tenant_id,
      agent.id,
      heartbeatPrompt,
      `heartbeat-${agent.id}`
    );

    await logActivity(
      agent.tenant_id,
      agent.id,
      'heartbeat',
      'agent',
      agent.id,
      {
        response_preview: result.response.slice(0, 200),
        is_ok: result.response.includes('HEARTBEAT_OK'),
        tokens_used: result.tokensIn + result.tokensOut,
      }
    );

    console.log(`Heartbeat for ${agent.name}: ${result.response.includes('HEARTBEAT_OK') ? 'OK' : 'Action needed'}`);
  } catch (error) {
    console.error(`Heartbeat failed for ${agent.name}:`, error instanceof Error ? error.message : error);
  }
}

async function runHeartbeatCycle(): Promise<void> {
  try {
    const agents = await getHeartbeatAgents();
    if (agents.length === 0) return;

    console.log(`Running heartbeat cycle for ${agents.length} agent(s)`);

    for (const agent of agents) {
      await runAgentHeartbeat(agent);
    }
  } catch (error) {
    console.error('Heartbeat cycle error:', error);
  }
}

export function startHeartbeatService(): void {
  if (heartbeatTimer) {
    console.log('Heartbeat service already running');
    return;
  }

  console.log(`Heartbeat service started (interval: ${HEARTBEAT_INTERVAL_MS / 1000}s)`);
  heartbeatTimer = setInterval(runHeartbeatCycle, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeatService(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log('Heartbeat service stopped');
  }
}

export async function triggerHeartbeat(tenantId: string, agentId: string): Promise<string> {
  const result = await pool.query(
    `SELECT id, tenant_id, name, heartbeat_md, model_config FROM agents
     WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
    [agentId, tenantId]
  );

  if (result.rows.length === 0) {
    throw new Error('Agent not found or not active');
  }

  const agent = result.rows[0];
  if (!agent.heartbeat_md) {
    throw new Error('Agent has no heartbeat checklist configured');
  }

  await runAgentHeartbeat(agent);
  return 'Heartbeat triggered successfully';
}
