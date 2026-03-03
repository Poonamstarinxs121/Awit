import { pool } from '../db/index.js';

interface NodeAgentMatch {
  nodeId: string;
  nodeName: string;
  agentName: string;
  agentStatus: string;
}

export async function findAgentNode(
  agentName: string,
  tenantId: string
): Promise<NodeAgentMatch | null> {
  const result = await pool.query(
    `SELECT nh.node_id, n.name AS node_name, nh.agent_statuses
     FROM node_heartbeats nh
     JOIN nodes n ON n.id = nh.node_id
     WHERE n.tenant_id = $1 AND n.status IN ('online', 'degraded')
     ORDER BY nh.created_at DESC`,
    [tenantId]
  );

  const seenNodes = new Set<string>();
  for (const row of result.rows) {
    if (seenNodes.has(row.node_id)) continue;
    seenNodes.add(row.node_id);

    const statuses: Array<{ name?: string; id?: string; status?: string }> = row.agent_statuses || [];
    for (const agent of statuses) {
      const name = agent.name || '';
      if (
        name.toLowerCase() === agentName.toLowerCase() ||
        name.toLowerCase().replace(/\s+/g, '') === agentName.toLowerCase().replace(/\s+/g, '')
      ) {
        return {
          nodeId: row.node_id,
          nodeName: row.node_name,
          agentName: name,
          agentStatus: agent.status || 'unknown',
        };
      }
    }
  }

  return null;
}

export async function isRemoteAgent(
  agentName: string,
  tenantId: string
): Promise<{ remote: boolean; nodeId?: string; nodeName?: string }> {
  const hubAgent = await pool.query(
    `SELECT id FROM agents WHERE tenant_id = $1 AND status = 'active' AND (
      LOWER(REPLACE(name, ' ', '')) = LOWER(REPLACE($2, ' ', ''))
      OR LOWER(name) = LOWER($2)
    ) LIMIT 1`,
    [tenantId, agentName]
  );

  if (hubAgent.rows.length > 0) {
    return { remote: false };
  }

  const nodeMatch = await findAgentNode(agentName, tenantId);
  if (nodeMatch) {
    return { remote: true, nodeId: nodeMatch.nodeId, nodeName: nodeMatch.nodeName };
  }

  return { remote: false };
}

export async function routeToNode(
  taskId: string,
  agentId: string,
  nodeId: string,
  tenantId: string
): Promise<{ dispatchId: string; nodeName: string }> {
  const nodeCheck = await pool.query(
    'SELECT id, name, status FROM nodes WHERE id = $1 AND tenant_id = $2',
    [nodeId, tenantId]
  );

  if (nodeCheck.rows.length === 0) {
    throw new Error('Node not found');
  }

  if (nodeCheck.rows[0].status === 'offline') {
    throw new Error('Target node is offline');
  }

  await pool.query('UPDATE tasks SET target_node_id = $1 WHERE id = $2', [nodeId, taskId]);

  const dispatch = await pool.query(
    `INSERT INTO task_dispatches (task_id, node_id, status, dispatched_at)
     VALUES ($1, $2, 'dispatched', NOW()) RETURNING id`,
    [taskId, nodeId]
  );

  return {
    dispatchId: dispatch.rows[0].id,
    nodeName: nodeCheck.rows[0].name,
  };
}

export async function createDispatchForRemoteAgent(
  tenantId: string,
  agentName: string,
  nodeId: string,
  userMessage: string
): Promise<{ dispatchId: string; nodeName: string; taskId: string }> {
  const taskResult = await pool.query(
    `INSERT INTO tasks (tenant_id, title, description, status, priority, created_by)
     VALUES ($1, $2, $3, 'assigned', 'medium', 'system')
     RETURNING id`,
    [
      tenantId,
      `Remote agent request: @${agentName}`,
      `Auto-dispatched message to remote agent "${agentName}": ${userMessage.slice(0, 500)}`,
    ]
  );

  const taskId = taskResult.rows[0].id;
  const result = await routeToNode(taskId, agentName, nodeId, tenantId);

  return { ...result, taskId };
}
