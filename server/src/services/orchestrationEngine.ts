import { pool } from '../db/index.js';
import { chatCompletion, chatCompletionStream, type ChatMessage, type LLMResponse } from './llmProviderClient.js';
import {
  getOrCreateSession,
  appendMessages,
  buildSystemPrompt,
  estimateTokenCount,
  needsCompaction,
  compactSession,
} from './sessionManager.js';
import { logActivity } from './activityService.js';
import { hybridMemorySearch, loadRecentMemories, saveMemoryWithEmbedding } from './memorySearchService.js';
import { allocateContextBudget } from './tokenBudgetAllocator.js';

export interface AgentTurnResult {
  response: string;
  sessionId: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: string;
}

interface AgentRow {
  id: string;
  tenant_id: string;
  name: string;
  role: string;
  soul_md: string;
  agents_md: string;
  tools_md: string;
  heartbeat_md: string;
  model_config: Record<string, unknown>;
  level: string;
  status: string;
}

async function loadAgent(tenantId: string, agentId: string): Promise<AgentRow> {
  const result = await pool.query(
    `SELECT * FROM agents WHERE id = $1 AND tenant_id = $2`,
    [agentId, tenantId]
  );
  if (result.rows.length === 0) {
    throw new Error('Agent not found');
  }
  const agent = result.rows[0];
  if (agent.status === 'disabled') {
    throw new Error('Agent is disabled');
  }
  return agent;
}

async function loadAgentMemories(tenantId: string, agentId: string, queryContext?: string): Promise<string> {
  let memories;

  if (queryContext && queryContext.length > 5) {
    memories = await hybridMemorySearch(tenantId, agentId, queryContext, 5);
  } else {
    memories = await loadRecentMemories(tenantId, agentId, 10);
  }

  if (memories.length === 0) return '';

  const memoryText = memories.map(m => `[${m.memory_type}] ${m.content}`).join('\n');
  return `\n## Relevant Memories\n${memoryText}`;
}

async function loadAgentTasks(tenantId: string, agentId: string): Promise<string> {
  const result = await pool.query(
    `SELECT title, status, priority, description FROM tasks
     WHERE tenant_id = $1 AND $2 = ANY(assignees) AND status != 'done'
     ORDER BY
       CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       created_at DESC
     LIMIT 5`,
    [tenantId, agentId]
  );

  if (result.rows.length === 0) return '';

  const tasks = result.rows.map((t: { title: string; status: string; priority: string; description: string }) =>
    `- [${t.priority.toUpperCase()}] ${t.title} (${t.status})${t.description ? ': ' + t.description.slice(0, 100) : ''}`
  ).join('\n');

  return `\n## Your Current Tasks\n${tasks}`;
}

export async function executeAgentTurn(
  tenantId: string,
  agentId: string,
  userMessage: string,
  sessionKey?: string,
  modelOverride?: { provider: string; model: string; temperature: number }
): Promise<AgentTurnResult> {
  const agent = await loadAgent(tenantId, agentId);
  const session = await getOrCreateSession(tenantId, agentId, sessionKey);

  const modelConfig = modelOverride || {
    provider: (agent.model_config?.provider as string) || 'openai',
    model: (agent.model_config?.model as string) || 'gpt-4o',
    temperature: (agent.model_config?.temperature as number) ?? 0.7,
  };

  const [memories, tasks] = await Promise.all([
    loadAgentMemories(tenantId, agentId, userMessage),
    loadAgentTasks(tenantId, agentId),
  ]);

  let soulContent = buildSystemPrompt(agent, session.compactionSummary);
  const historyContent = session.messages.map(m => `${m.role}: ${m.content}`).join('\n');

  let budget = allocateContextBudget(modelConfig.model || 'gpt-4o-mini', {
    soul: soulContent,
    memories: memories || '',
    tasks: tasks || '',
    history: historyContent,
    userMessage: userMessage,
  });

  if (budget.sectionsInfo.some(s => s.truncated)) {
    console.log(`[Budget] Context trimmed for ${agentId}: ${budget.sectionsInfo.filter(s => s.truncated).map(s => s.name).join(', ')} (${budget.budgetUsed}% used)`);
  }

  let systemPrompt = budget.soul;
  if (budget.memories) systemPrompt += budget.memories;
  if (budget.tasks) systemPrompt += budget.tasks;

  const conversationMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...session.messages,
    { role: 'user', content: budget.userMessage },
  ];

  if (needsCompaction(estimateTokenCount(conversationMessages))) {
    try {
      const flushPrompt: ChatMessage[] = [
        { role: 'system', content: 'You are a memory extraction assistant. Extract important facts, decisions, preferences, and learnings from this conversation that should be remembered long-term. Output them as a concise bullet list. If nothing is worth remembering, respond with "NOTHING_TO_REMEMBER".' },
        ...session.messages,
        { role: 'user', content: 'Extract durable facts and learnings from the conversation above.' },
      ];
      const flushConfig = { provider: modelConfig.provider, model: modelConfig.provider === 'anthropic' ? 'claude-3-haiku-20240307' : 'gpt-4o-mini', temperature: 0.2 };
      const flushResult = await chatCompletion(tenantId, agentId, flushPrompt, flushConfig);

      if (!flushResult.content.includes('NOTHING_TO_REMEMBER') && flushResult.content.trim().length > 10) {
        await saveMemoryWithEmbedding(tenantId, agentId, 'long_term', flushResult.content);
      }
    } catch (flushError) {
      console.error('Memory flush failed (non-fatal):', flushError instanceof Error ? flushError.message : flushError);
    }

    await compactSession(
      session.id,
      session.messages,
      async (msgs) => {
        const compactPrompt: ChatMessage[] = [
          { role: 'system', content: 'Summarize this conversation concisely, preserving key decisions, action items, and important context.' },
          ...msgs,
          { role: 'user', content: 'Provide a concise summary of the conversation above.' },
        ];
        const result = await chatCompletion(tenantId, agentId, compactPrompt, modelConfig);
        return result.content;
      }
    );

    const refreshedSession = await getOrCreateSession(tenantId, agentId, sessionKey);
    soulContent = buildSystemPrompt(agent, refreshedSession.compactionSummary);
    const refreshedHistory = refreshedSession.messages.map(m => `${m.role}: ${m.content}`).join('\n');

    budget = allocateContextBudget(modelConfig.model || 'gpt-4o-mini', {
      soul: soulContent,
      memories: memories || '',
      tasks: tasks || '',
      history: refreshedHistory,
      userMessage: userMessage,
    });

    systemPrompt = budget.soul;
    if (budget.memories) systemPrompt += budget.memories;
    if (budget.tasks) systemPrompt += budget.tasks;

    conversationMessages.length = 0;
    conversationMessages.push(
      { role: 'system', content: systemPrompt },
      ...refreshedSession.messages,
      { role: 'user', content: budget.userMessage },
    );
  }

  const llmResponse = await chatCompletion(tenantId, agentId, conversationMessages, modelConfig);

  const newMessages: ChatMessage[] = [
    { role: 'user', content: userMessage },
    { role: 'assistant', content: llmResponse.content },
  ];

  const newTokenCount = estimateTokenCount([...session.messages, ...newMessages]);
  await appendMessages(session.id, newMessages, newTokenCount);

  await logActivity(
    tenantId,
    agentId,
    'agent_response',
    'agent',
    agentId,
    {
      session_id: session.id,
      tokens_in: llmResponse.tokensIn,
      tokens_out: llmResponse.tokensOut,
      model: llmResponse.model,
    }
  );

  return {
    response: llmResponse.content,
    sessionId: session.id,
    tokensIn: llmResponse.tokensIn,
    tokensOut: llmResponse.tokensOut,
    model: llmResponse.model,
    provider: llmResponse.provider,
  };
}

export async function executeAgentTurnStream(
  tenantId: string,
  agentId: string,
  userMessage: string,
  onChunk: (chunk: string) => void,
  sessionKey?: string,
  modelOverride?: { provider: string; model: string; temperature: number }
): Promise<AgentTurnResult> {
  const agent = await loadAgent(tenantId, agentId);
  const session = await getOrCreateSession(tenantId, agentId, sessionKey);

  const modelConfig = modelOverride || {
    provider: (agent.model_config?.provider as string) || 'openai',
    model: (agent.model_config?.model as string) || 'gpt-4o',
    temperature: (agent.model_config?.temperature as number) ?? 0.7,
  };

  const [memories, tasks] = await Promise.all([
    loadAgentMemories(tenantId, agentId, userMessage),
    loadAgentTasks(tenantId, agentId),
  ]);

  const soulContent = buildSystemPrompt(agent, session.compactionSummary);
  const historyContent = session.messages.map(m => `${m.role}: ${m.content}`).join('\n');

  const budget = allocateContextBudget(modelConfig.model || 'gpt-4o-mini', {
    soul: soulContent,
    memories: memories || '',
    tasks: tasks || '',
    history: historyContent,
    userMessage: userMessage,
  });

  if (budget.sectionsInfo.some(s => s.truncated)) {
    console.log(`[Budget] Stream context trimmed for ${agentId}: ${budget.sectionsInfo.filter(s => s.truncated).map(s => s.name).join(', ')} (${budget.budgetUsed}% used)`);
  }

  let systemPrompt = budget.soul;
  if (budget.memories) systemPrompt += budget.memories;
  if (budget.tasks) systemPrompt += budget.tasks;

  const conversationMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...session.messages,
    { role: 'user', content: budget.userMessage },
  ];

  const llmResponse = await chatCompletionStream(
    tenantId, agentId, conversationMessages, modelConfig, onChunk
  );

  const newMessages: ChatMessage[] = [
    { role: 'user', content: userMessage },
    { role: 'assistant', content: llmResponse.content },
  ];

  const newTokenCount = estimateTokenCount([...session.messages, ...newMessages]);
  await appendMessages(session.id, newMessages, newTokenCount);

  await logActivity(
    tenantId,
    agentId,
    'agent_response',
    'agent',
    agentId,
    {
      session_id: session.id,
      tokens_in: llmResponse.tokensIn,
      tokens_out: llmResponse.tokensOut,
      model: llmResponse.model,
    }
  );

  return {
    response: llmResponse.content,
    sessionId: session.id,
    tokensIn: llmResponse.tokensIn,
    tokensOut: llmResponse.tokensOut,
    model: llmResponse.model,
    provider: llmResponse.provider,
  };
}
