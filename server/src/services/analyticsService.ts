import { pool } from '../db/index.js';

interface AgentMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  avgResponseTime: number;
  totalTokensUsed: number;
  totalCost: number;
  errorCount: number;
  errorRate: number;
  avgTokensPerTask: number;
  recentActivity: Array<{ date: string; tasks: number; tokens: number; cost: number; errors: number }>;
}

export async function getAgentMetrics(tenantId: string, agentId: string, days: number = 30): Promise<AgentMetrics> {
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const agentResult = await pool.query(
    `SELECT name FROM agents WHERE id = $1 AND tenant_id = $2`,
    [agentId, tenantId]
  );
  const agentName = agentResult.rows[0]?.name || 'Unknown';

  const taskResult = await pool.query(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'done') as completed
     FROM tasks 
     WHERE tenant_id = $1 AND $2 = ANY(assignees) AND created_at >= $3`,
    [tenantId, agentId, sinceDate]
  );
  const totalTasks = parseInt(taskResult.rows[0].total);
  const completedTasks = parseInt(taskResult.rows[0].completed);

  const usageResult = await pool.query(
    `SELECT 
       COALESCE(SUM(tokens_used), 0) as total_tokens,
       COALESCE(SUM(cost), 0) as total_cost,
       COUNT(*) as total_calls,
       COUNT(*) FILTER (WHERE tokens_used = 0 OR cost = 0) as error_calls
     FROM usage_logs
     WHERE tenant_id = $1 AND agent_id = $2 AND created_at >= $3`,
    [tenantId, agentId, sinceDate]
  );
  const totalTokens = parseInt(usageResult.rows[0].total_tokens);
  const totalCost = parseFloat(usageResult.rows[0].total_cost);
  const totalCalls = parseInt(usageResult.rows[0].total_calls);
  const errorCalls = parseInt(usageResult.rows[0].error_calls);

  const dailyResult = await pool.query(
    `SELECT 
       DATE(created_at) as date,
       COUNT(DISTINCT CASE WHEN 'tasks' = 'tasks' THEN NULL END) as tasks,
       COALESCE(SUM(tokens_used), 0) as tokens,
       COALESCE(SUM(cost), 0) as cost,
       COUNT(*) FILTER (WHERE tokens_used = 0) as errors
     FROM usage_logs
     WHERE tenant_id = $1 AND agent_id = $2 AND created_at >= $3
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [tenantId, agentId, sinceDate]
  );

  const dailyTaskResult = await pool.query(
    `SELECT DATE(created_at) as date, COUNT(*) as tasks
     FROM tasks
     WHERE tenant_id = $1 AND $2 = ANY(assignees) AND created_at >= $3
     GROUP BY DATE(created_at)`,
    [tenantId, agentId, sinceDate]
  );
  const tasksByDate = new Map(dailyTaskResult.rows.map((r: any) => [r.date.toISOString().split('T')[0], parseInt(r.tasks)]));

  const recentActivity = dailyResult.rows.map((r: any) => ({
    date: r.date.toISOString().split('T')[0],
    tasks: tasksByDate.get(r.date.toISOString().split('T')[0]) || 0,
    tokens: parseInt(r.tokens),
    cost: parseFloat(r.cost),
    errors: parseInt(r.errors),
  }));

  return {
    agentId,
    agentName,
    totalTasks,
    completedTasks,
    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    avgResponseTime: 0,
    totalTokensUsed: totalTokens,
    totalCost,
    errorCount: errorCalls,
    errorRate: totalCalls > 0 ? Math.round((errorCalls / totalCalls) * 100) : 0,
    avgTokensPerTask: totalTasks > 0 ? Math.round(totalTokens / totalTasks) : 0,
    recentActivity,
  };
}

export async function getAllAgentMetrics(tenantId: string, days: number = 30): Promise<AgentMetrics[]> {
  const agentsResult = await pool.query(
    `SELECT id FROM agents WHERE tenant_id = $1 AND status = 'active'`,
    [tenantId]
  );

  const metrics = await Promise.all(
    agentsResult.rows.map((a: any) => getAgentMetrics(tenantId, a.id, days))
  );

  return metrics.sort((a, b) => b.totalCost - a.totalCost);
}
