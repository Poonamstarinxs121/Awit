import { pool } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from './llmProviderClient.js';

export interface SessionData {
  id: string;
  tenantId: string;
  agentId: string;
  sessionKey: string;
  messages: ChatMessage[];
  compactionSummary: string | null;
  tokenCount: number;
  modelConfig: Record<string, unknown>;
  status: string;
}

const MAX_TOKEN_THRESHOLD = 80000;
const COMPACTION_TARGET = 20000;

export async function getOrCreateSession(
  tenantId: string,
  agentId: string,
  sessionKey?: string
): Promise<SessionData> {
  const key = sessionKey || `default-${agentId}`;

  const result = await pool.query(
    `SELECT * FROM sessions WHERE tenant_id = $1 AND agent_id = $2 AND session_key = $3 AND status != 'archived'
     ORDER BY last_active_at DESC LIMIT 1`,
    [tenantId, agentId, key]
  );

  if (result.rows.length > 0) {
    const row = result.rows[0];
    let messages: ChatMessage[] = [];
    try {
      messages = JSON.parse(row.conversation_buffer || '[]');
    } catch {
      messages = [];
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      agentId: row.agent_id,
      sessionKey: row.session_key,
      messages,
      compactionSummary: row.compaction_summary,
      tokenCount: row.token_count,
      modelConfig: row.model_config || {},
      status: row.status,
    };
  }

  const id = uuidv4();
  await pool.query(
    `INSERT INTO sessions (id, tenant_id, agent_id, session_key, conversation_buffer, token_count, model_config, status)
     VALUES ($1, $2, $3, $4, '[]', 0, '{}', 'active')`,
    [id, tenantId, agentId, key]
  );

  return {
    id,
    tenantId,
    agentId,
    sessionKey: key,
    messages: [],
    compactionSummary: null,
    tokenCount: 0,
    modelConfig: {},
    status: 'active',
  };
}

export async function appendMessages(
  sessionId: string,
  newMessages: ChatMessage[],
  totalTokenCount: number
): Promise<void> {
  const result = await pool.query(
    `SELECT conversation_buffer FROM sessions WHERE id = $1`,
    [sessionId]
  );

  let existing: ChatMessage[] = [];
  try {
    existing = JSON.parse(result.rows[0]?.conversation_buffer || '[]');
  } catch {
    existing = [];
  }

  const combined = [...existing, ...newMessages];

  await pool.query(
    `UPDATE sessions SET conversation_buffer = $1, token_count = $2, last_active_at = now(), status = 'active'
     WHERE id = $3`,
    [JSON.stringify(combined), totalTokenCount, sessionId]
  );
}

export async function getSessionHistory(
  tenantId: string,
  agentId: string,
  sessionKey?: string,
  limit?: number
): Promise<ChatMessage[]> {
  const session = await getOrCreateSession(tenantId, agentId, sessionKey);
  const messages = session.messages;
  if (limit && messages.length > limit) {
    return messages.slice(-limit);
  }
  return messages;
}

export async function clearSession(
  tenantId: string,
  agentId: string,
  sessionKey?: string
): Promise<void> {
  const key = sessionKey || `default-${agentId}`;
  await pool.query(
    `UPDATE sessions SET status = 'archived' WHERE tenant_id = $1 AND agent_id = $2 AND session_key = $3`,
    [tenantId, agentId, key]
  );
}

export function buildSystemPrompt(agent: {
  name: string;
  role: string;
  soul_md: string;
  agents_md: string;
  tools_md: string;
}, compactionSummary: string | null): string {
  const parts: string[] = [];

  parts.push(`You are ${agent.name}, an AI agent.`);
  parts.push(`Role: ${agent.role}`);

  if (agent.soul_md) {
    parts.push(`\n## SOUL (Personality & Boundaries)\n${agent.soul_md}`);
  }

  if (agent.agents_md) {
    parts.push(`\n## Operating Instructions\n${agent.agents_md}`);
  }

  if (agent.tools_md) {
    parts.push(`\n## Capabilities & Tools\n${agent.tools_md}`);
  }

  parts.push(`\n## Guidelines`);
  parts.push(`- Be concise and actionable in your responses`);
  parts.push(`- Stay in character according to your SOUL definition`);
  parts.push(`- When asked about tasks, provide specific next steps`);
  parts.push(`- Reference your role and specialization when relevant`);

  if (compactionSummary) {
    parts.push(`\n## Previous Conversation Summary\n${compactionSummary}`);
  }

  return parts.join('\n');
}

export function estimateTokenCount(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += Math.ceil(msg.content.length / 4) + 4;
  }
  return total;
}

export function needsCompaction(tokenCount: number): boolean {
  return tokenCount > MAX_TOKEN_THRESHOLD;
}

export async function compactSession(
  sessionId: string,
  messages: ChatMessage[],
  compactFn: (messages: ChatMessage[]) => Promise<string>
): Promise<{ summary: string; remainingMessages: ChatMessage[] }> {
  const cutoff = Math.floor(messages.length * 0.7);
  const toCompact = messages.slice(0, cutoff);
  const toKeep = messages.slice(cutoff);

  const summary = await compactFn(toCompact);

  await pool.query(
    `UPDATE sessions SET
       conversation_buffer = $1,
       compaction_summary = $2,
       token_count = $3,
       last_active_at = now()
     WHERE id = $4`,
    [
      JSON.stringify(toKeep),
      summary,
      estimateTokenCount(toKeep),
      sessionId,
    ]
  );

  return { summary, remainingMessages: toKeep };
}
