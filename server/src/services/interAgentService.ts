import { pool } from '../db/index.js';
import { executeAgentTurn } from './orchestrationEngine.js';
import { logActivity } from './activityService.js';

const MAX_PING_PONG_DEPTH = 3;

interface InterAgentMessage {
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  message: string;
  taskId?: string;
  depth: number;
}

export async function sendInterAgentMessage(
  tenantId: string,
  fromAgentId: string,
  toAgentId: string,
  message: string,
  taskId?: string,
  depth: number = 0
): Promise<{ response: string; depth: number }> {
  if (depth >= MAX_PING_PONG_DEPTH) {
    return { response: '[Max collaboration depth reached. Please continue independently.]', depth };
  }

  if (fromAgentId === toAgentId) {
    return { response: '[Cannot message yourself.]', depth };
  }

  const agentsResult = await pool.query(
    `SELECT id, name, role FROM agents WHERE id = ANY($1) AND tenant_id = $2 AND status = 'active'`,
    [[fromAgentId, toAgentId], tenantId]
  );

  const agents = agentsResult.rows;
  const fromAgent = agents.find((a: { id: string }) => a.id === fromAgentId);
  const toAgent = agents.find((a: { id: string }) => a.id === toAgentId);

  if (!fromAgent || !toAgent) {
    throw new Error('One or both agents not found or inactive');
  }

  const contextPrompt = `[INTER-AGENT MESSAGE from ${fromAgent.name} (${fromAgent.role})]
${taskId ? `Context: This relates to a task you're both working on.` : ''}

${fromAgent.name} says: "${message}"

Please respond to ${fromAgent.name}'s message. Be collaborative and helpful. If you need to ask them something back, note that this is message round ${depth + 1} of ${MAX_PING_PONG_DEPTH} maximum.`;

  const result = await executeAgentTurn(
    tenantId,
    toAgentId,
    contextPrompt,
    `collab-${fromAgentId}-${toAgentId}${taskId ? `-${taskId}` : ''}`
  );

  await logActivity(tenantId, fromAgentId, 'inter_agent_message', 'agent', toAgentId, {
    from: fromAgent.name,
    to: toAgent.name,
    message_preview: message.slice(0, 200),
    response_preview: result.response.slice(0, 200),
    depth,
    task_id: taskId,
  });

  return { response: result.response, depth: depth + 1 };
}

export async function requestAgentCollaboration(
  tenantId: string,
  requestingAgentId: string,
  targetAgentId: string,
  request: string,
  taskId?: string
): Promise<{ conversation: Array<{ from: string; message: string }> }> {
  const conversation: Array<{ from: string; message: string }> = [];

  const agentsResult = await pool.query(
    `SELECT id, name FROM agents WHERE id = ANY($1) AND tenant_id = $2`,
    [[requestingAgentId, targetAgentId], tenantId]
  );
  const agents = agentsResult.rows;
  const requester = agents.find((a: { id: string }) => a.id === requestingAgentId);
  const target = agents.find((a: { id: string }) => a.id === targetAgentId);

  conversation.push({ from: requester?.name || requestingAgentId, message: request });

  const response = await sendInterAgentMessage(tenantId, requestingAgentId, targetAgentId, request, taskId, 0);
  conversation.push({ from: target?.name || targetAgentId, message: response.response });

  return { conversation };
}
