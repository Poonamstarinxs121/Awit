import { pool } from '../db/index.js';
import { chatCompletion, type ChatMessage } from './llmProviderClient.js';
import { logActivity } from './activityService.js';
import { fireWebhookEvent } from './webhookService.js';

interface AgentSummary {
  agentId: string;
  agentName: string;
  completed: string[];
  inProgress: string[];
  blockers: string[];
}

export interface StandupResult {
  id: string;
  tenantId: string;
  date: string;
  summary: string;
  perAgentSummaries: AgentSummary[];
}

export async function generateStandup(tenantId: string): Promise<StandupResult> {
  const agentsResult = await pool.query(
    `SELECT id, name, role FROM agents WHERE tenant_id = $1 AND status = 'active'`,
    [tenantId]
  );
  const agents = agentsResult.rows;

  const perAgentSummaries: AgentSummary[] = [];

  for (const agent of agents) {
    const agentIdStr = agent.id.toString();

    const [completedRes, inProgressRes, blockedRes, activityRes] = await Promise.all([
      pool.query(
        `SELECT title FROM tasks WHERE tenant_id = $1 AND $2 = ANY(assignees) AND status = 'done' AND updated_at >= NOW() - INTERVAL '24 hours'`,
        [tenantId, agent.id]
      ),
      pool.query(
        `SELECT title FROM tasks WHERE tenant_id = $1 AND $2 = ANY(assignees) AND status = 'in_progress'`,
        [tenantId, agent.id]
      ),
      pool.query(
        `SELECT title, blocker_reason FROM tasks WHERE tenant_id = $1 AND $2 = ANY(assignees) AND is_blocked = true`,
        [tenantId, agent.id]
      ),
      pool.query(
        `SELECT COUNT(*) FROM activities WHERE tenant_id = $1 AND actor_id = $2 AND created_at >= NOW() - INTERVAL '24 hours'`,
        [tenantId, agentIdStr]
      ),
    ]);

    const completed = completedRes.rows.map((r: { title: string }) => r.title);
    const inProgress = inProgressRes.rows.map((r: { title: string }) => r.title);
    const blockers = blockedRes.rows.map((r: { title: string; blocker_reason?: string }) =>
      r.blocker_reason ? `${r.title}: ${r.blocker_reason}` : r.title
    );

    const activityCount = parseInt(activityRes.rows[0].count, 10);

    if (completed.length > 0 || inProgress.length > 0 || blockers.length > 0 || activityCount > 0) {
      perAgentSummaries.push({
        agentId: agentIdStr,
        agentName: agent.name,
        completed,
        inProgress,
        blockers,
      });
    }
  }

  let summary: string;
  try {
    summary = await generateLLMSummary(tenantId, perAgentSummaries);
  } catch {
    summary = generateTemplateSummary(perAgentSummaries);
  }

  const standupId = await upsertStandup(tenantId, summary, perAgentSummaries);

  const today = new Date().toISOString().split('T')[0];
  await logActivity(tenantId, 'system', 'standup_generated', 'standup', standupId, {
    date: today,
    agentCount: agents.length,
  });

  const standup = {
    id: standupId,
    tenantId,
    date: today,
    summary,
    perAgentSummaries,
  };

  fireWebhookEvent(tenantId, 'standup.generated', { standup }).catch(() => {});

  return standup;
}

async function generateLLMSummary(tenantId: string, summaries: AgentSummary[]): Promise<string> {
  const systemPrompt = `You are a project manager generating a daily standup summary for a software team. 
Summarize the team's progress concisely in a professional narrative format.
Include highlights, blockers, and overall team health assessment.
Keep it under 300 words.`;

  const userMessage = JSON.stringify(summaries, null, 2);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const response = await chatCompletion(tenantId, 'system', messages, {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.5,
  });

  return response.content;
}

function generateTemplateSummary(summaries: AgentSummary[]): string {
  const today = new Date().toISOString().split('T')[0];
  const lines: string[] = [`Daily Standup - ${today}`];

  if (summaries.length === 0) {
    lines.push('No significant activity in the last 24 hours.');
  } else {
    for (const s of summaries) {
      lines.push(
        `- ${s.agentName}: Completed ${s.completed.length} tasks, ${s.inProgress.length} in progress, ${s.blockers.length} blockers`
      );
    }
  }

  return lines.join('\n');
}

async function upsertStandup(
  tenantId: string,
  summary: string,
  perAgentSummaries: AgentSummary[]
): Promise<string> {
  const jsonSummaries = JSON.stringify(perAgentSummaries);

  const existing = await pool.query(
    `SELECT id FROM standups WHERE tenant_id = $1 AND date = CURRENT_DATE`,
    [tenantId]
  );

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await pool.query(
      `UPDATE standups SET summary = $1, per_agent_summaries = $2 WHERE id = $3`,
      [summary, jsonSummaries, id]
    );
    return id;
  }

  const result = await pool.query(
    `INSERT INTO standups (tenant_id, date, summary, per_agent_summaries, delivered_to)
     VALUES ($1, CURRENT_DATE, $2, $3, $4)
     RETURNING id`,
    [tenantId, summary, jsonSummaries, '{}']
  );

  return result.rows[0].id;
}
