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
import { getMachines, getMachinesInGroup, executeRemoteCommand } from './sshService.js';
import { isRemoteAgent, createDispatchForRemoteAgent } from './nodeRouterService.js';

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

async function loadAgentSkills(agentId: string): Promise<string> {
  try {
    const result = await pool.query(
      `SELECT s.name, s.tools_md FROM agent_skills ags
       JOIN skills s ON s.id = ags.skill_id
       WHERE ags.agent_id = $1 ORDER BY s.name ASC`,
      [agentId]
    );
    if (result.rows.length === 0) return '';
    const skillSections = result.rows.map((s: any) => s.tools_md).filter(Boolean).join('\n\n');
    return skillSections ? `\n\n## Installed Skills\n${skillSections}` : '';
  } catch {
    return '';
  }
}

async function loadMachineContext(tenantId: string, agentLevel: string): Promise<string> {
  if (agentLevel !== 'lead') return '';
  try {
    const machines = await getMachines(tenantId);
    if (machines.length === 0) return '';

    const groups = new Map<string, string[]>();
    const machineLines: string[] = [];

    for (const m of machines) {
      const statusDot = m.status === 'online' ? '✅' : m.status === 'offline' ? '❌' : '⬜';
      machineLines.push(`  - ${m.name} (id: ${m.name.toLowerCase().replace(/\s+/g, '-')}, host: ${m.host}, ${statusDot} ${m.status})`);
      if (m.group_name) {
        const key = m.group_name;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(m.name);
      }
    }

    const groupLines = [...groups.entries()].map(([g, ms]) => `  - ${g}: ${ms.join(', ')}`);

    return `\n\n## Your Managed Machines
You can execute shell commands on registered machines via SSH. Use this EXACT syntax:
  Single machine: [EXEC mac-mini-1: df -h]
  Group:          [EXEC group:dev-macs: brew upgrade]
Rules: Use the machine name (lowercase, hyphens) or group name. You will receive output and then give a final answer.

Machines:
${machineLines.join('\n')}
${groupLines.length > 0 ? `\nGroups:\n${groupLines.join('\n')}` : ''}`;
  } catch {
    return '';
  }
}

const EXEC_PATTERN = /\[EXEC ([^\]]+?):\s*([^\]]+?)\]/g;

async function processExecBlocks(tenantId: string, response: string): Promise<string | null> {
  const matches = [...response.matchAll(EXEC_PATTERN)];
  if (matches.length === 0) return null;

  const results: string[] = [];

  for (const match of matches) {
    const target = match[1].trim();
    const command = match[2].trim();

    try {
      if (target.startsWith('group:')) {
        const groupName = target.slice(6).trim();
        const groupResult = await pool.query(
          `SELECT mg.id FROM machine_groups mg
           JOIN machines m ON m.group_id = mg.id
           WHERE mg.name ILIKE $1
           LIMIT 1`,
          [groupName]
        );
        if (groupResult.rows[0]) {
          const groupId = groupResult.rows[0].id;
          const tenantResult = await pool.query(
            `SELECT tenant_id FROM machine_groups WHERE id = $1`, [groupId]
          );
          const gTenantId = tenantResult.rows[0]?.tenant_id || tenantId;
          const machines = await getMachinesInGroup(gTenantId, groupId);
          const machineResults = await Promise.all(
            machines.map(async (m) => {
              const r = await executeRemoteCommand(m, command);
              return `[${m.name}] exit:${r.exitCode}\n${r.stdout || r.stderr || '(no output)'}`;
            })
          );
          results.push(`Command output for group "${groupName}" (${command}):\n${machineResults.join('\n---\n')}`);
        } else {
          results.push(`Group "${groupName}" not found or has no machines.`);
        }
      } else {
        const machineResult = await pool.query(
          `SELECT * FROM machines WHERE tenant_id = $1 AND (
            LOWER(REPLACE(name, ' ', '-')) = LOWER($2) OR
            name ILIKE $2
          ) LIMIT 1`,
          [tenantId, target]
        );
        if (machineResult.rows[0]) {
          const machine = machineResult.rows[0];
          const { executeRemoteCommand: execCmd } = await import('./sshService.js');
          const r = await execCmd(machine, command);
          const output = r.stdout || r.stderr || '(no output)';
          results.push(`Command output from "${machine.name}" (${command}):\n${output}\nExit code: ${r.exitCode}`);
        } else {
          results.push(`Machine "${target}" not found.`);
        }
      }
    } catch (error) {
      results.push(`Error executing command on "${target}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return results.join('\n\n');
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

  const [memories, tasks, machineContext, skillsContext] = await Promise.all([
    loadAgentMemories(tenantId, agentId, userMessage),
    loadAgentTasks(tenantId, agentId),
    loadMachineContext(tenantId, agent.level),
    loadAgentSkills(agentId),
  ]);

  let soulContent = buildSystemPrompt(agent, session.compactionSummary);
  if (machineContext) soulContent += machineContext;
  if (skillsContext) soulContent += skillsContext;
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

  let llmResponse = await chatCompletion(tenantId, agentId, conversationMessages, modelConfig);

  const execOutput = await processExecBlocks(tenantId, llmResponse.content);
  if (execOutput) {
    const followUpMessages: ChatMessage[] = [
      ...conversationMessages,
      { role: 'assistant', content: llmResponse.content },
      { role: 'user', content: `Command execution results:\n\n${execOutput}\n\nPlease provide a clear, concise summary of the results for the user.` },
    ];
    try {
      const followUp = await chatCompletion(tenantId, agentId, followUpMessages, modelConfig);
      llmResponse = { ...followUp, tokensIn: llmResponse.tokensIn + followUp.tokensIn, tokensOut: llmResponse.tokensOut + followUp.tokensOut };
    } catch (execError) {
      console.error('[Orchestration] EXEC follow-up failed:', execError instanceof Error ? execError.message : execError);
      llmResponse = { ...llmResponse, content: `${llmResponse.content}\n\n**Execution results:**\n${execOutput}` };
    }
  }

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

const AGENT_MENTION_PATTERN = /@([A-Za-z0-9_][A-Za-z0-9_ -]*)/g;

export async function resolveAgentMention(
  tenantId: string,
  agentName: string,
  userMessage: string
): Promise<{ remote: boolean; dispatched?: boolean; dispatchMessage?: string; agentId?: string }> {
  try {
    const remoteCheck = await isRemoteAgent(agentName, tenantId);
    if (!remoteCheck.remote) {
      const localAgent = await pool.query(
        `SELECT id FROM agents WHERE tenant_id = $1 AND status = 'active' AND (
          LOWER(REPLACE(name, ' ', '')) = LOWER(REPLACE($2, ' ', ''))
          OR LOWER(name) = LOWER($2)
        ) LIMIT 1`,
        [tenantId, agentName]
      );
      return {
        remote: false,
        agentId: localAgent.rows[0]?.id || undefined,
      };
    }

    const dispatch = await createDispatchForRemoteAgent(
      tenantId,
      agentName,
      remoteCheck.nodeId!,
      userMessage
    );

    await logActivity(
      tenantId,
      'system',
      'remote_dispatch',
      'agent',
      agentName,
      {
        node_id: remoteCheck.nodeId,
        node_name: remoteCheck.nodeName,
        dispatch_id: dispatch.dispatchId,
        task_id: dispatch.taskId,
      }
    );

    return {
      remote: true,
      dispatched: true,
      dispatchMessage: `Task dispatched to ${remoteCheck.nodeName} for agent @${agentName}. Dispatch ID: ${dispatch.dispatchId}`,
    };
  } catch (error) {
    console.error(`[NodeRouter] Failed to resolve agent mention @${agentName}:`, error instanceof Error ? error.message : error);
    return { remote: false };
  }
}

export function extractMentions(content: string): string[] {
  const matches = [...content.matchAll(AGENT_MENTION_PATTERN)];
  return matches.map(m => m[1].trim());
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

  const [memories, tasks, skillsContextStream] = await Promise.all([
    loadAgentMemories(tenantId, agentId, userMessage),
    loadAgentTasks(tenantId, agentId),
    loadAgentSkills(agentId),
  ]);

  let soulContentStream = buildSystemPrompt(agent, session.compactionSummary);
  if (skillsContextStream) soulContentStream += skillsContextStream;
  const historyContent = session.messages.map(m => `${m.role}: ${m.content}`).join('\n');

  const budget = allocateContextBudget(modelConfig.model || 'gpt-4o-mini', {
    soul: soulContentStream,
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
