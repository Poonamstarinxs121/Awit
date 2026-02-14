function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface ContextSection {
  name: string;
  content: string;
  priority: number;
  minTokens: number;
}

interface ModelLimits {
  maxContext: number;
  reserveForOutput: number;
}

const MODEL_CONTEXT_LIMITS: Record<string, ModelLimits> = {
  'gpt-4o': { maxContext: 128000, reserveForOutput: 4096 },
  'gpt-4o-mini': { maxContext: 128000, reserveForOutput: 4096 },
  'gpt-4-turbo': { maxContext: 128000, reserveForOutput: 4096 },
  'gpt-3.5-turbo': { maxContext: 16384, reserveForOutput: 4096 },
  'claude-3-5-sonnet-20241022': { maxContext: 200000, reserveForOutput: 4096 },
  'claude-3-haiku-20240307': { maxContext: 200000, reserveForOutput: 4096 },
  'gemini-2.0-flash': { maxContext: 1048576, reserveForOutput: 8192 },
  'gemini-1.5-pro': { maxContext: 2097152, reserveForOutput: 8192 },
  'gemini-1.5-flash': { maxContext: 1048576, reserveForOutput: 8192 },
  'mistral-large-latest': { maxContext: 128000, reserveForOutput: 4096 },
  'mistral-small-latest': { maxContext: 32000, reserveForOutput: 4096 },
  'open-mistral-nemo': { maxContext: 128000, reserveForOutput: 4096 },
  'llama-3.3-70b-versatile': { maxContext: 128000, reserveForOutput: 4096 },
  'llama-3.1-8b-instant': { maxContext: 131072, reserveForOutput: 4096 },
  'mixtral-8x7b-32768': { maxContext: 32768, reserveForOutput: 4096 },
};

function getModelLimits(model: string): ModelLimits {
  return MODEL_CONTEXT_LIMITS[model] || { maxContext: 16384, reserveForOutput: 4096 };
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n... [truncated to fit context window]';
}

export interface BudgetAllocation {
  soul: string;
  memories: string;
  tasks: string;
  history: string;
  userMessage: string;
  totalTokens: number;
  budgetUsed: number;
  sectionsInfo: Array<{ name: string; allocated: number; used: number; truncated: boolean }>;
}

export function allocateContextBudget(
  model: string,
  sections: {
    soul: string;
    memories: string;
    tasks: string;
    history: string;
    userMessage: string;
  }
): BudgetAllocation {
  const limits = getModelLimits(model);
  const availableTokens = limits.maxContext - limits.reserveForOutput;

  const contextSections: ContextSection[] = [
    { name: 'userMessage', content: sections.userMessage, priority: 1, minTokens: 500 },
    { name: 'soul', content: sections.soul, priority: 2, minTokens: 200 },
    { name: 'tasks', content: sections.tasks, priority: 3, minTokens: 200 },
    { name: 'memories', content: sections.memories, priority: 4, minTokens: 100 },
    { name: 'history', content: sections.history, priority: 5, minTokens: 100 },
  ];

  const tokenCounts = contextSections.map(s => ({
    ...s,
    currentTokens: estimateTokens(s.content),
  }));

  const totalNeeded = tokenCounts.reduce((sum, s) => sum + s.currentTokens, 0);

  if (totalNeeded <= availableTokens) {
    return {
      soul: sections.soul,
      memories: sections.memories,
      tasks: sections.tasks,
      history: sections.history,
      userMessage: sections.userMessage,
      totalTokens: totalNeeded,
      budgetUsed: Math.round((totalNeeded / availableTokens) * 100),
      sectionsInfo: tokenCounts.map(s => ({
        name: s.name,
        allocated: s.currentTokens,
        used: s.currentTokens,
        truncated: false,
      })),
    };
  }

  const minTotal = contextSections.reduce((sum, s) => sum + s.minTokens, 0);
  const remainingBudget = availableTokens - minTotal;

  const priorityWeights: Record<number, number> = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
  const totalWeight = tokenCounts.reduce((sum, s) => sum + priorityWeights[s.priority], 0);

  const allocations: Record<string, number> = {};
  for (const section of tokenCounts) {
    const weight = priorityWeights[section.priority];
    const extraBudget = Math.floor((weight / totalWeight) * remainingBudget);
    const maxNeeded = section.currentTokens;
    allocations[section.name] = Math.min(section.minTokens + extraBudget, maxNeeded);
  }

  const result: BudgetAllocation = {
    soul: truncateToTokens(sections.soul, allocations['soul']),
    memories: truncateToTokens(sections.memories, allocations['memories']),
    tasks: truncateToTokens(sections.tasks, allocations['tasks']),
    history: truncateToTokens(sections.history, allocations['history']),
    userMessage: truncateToTokens(sections.userMessage, allocations['userMessage']),
    totalTokens: Object.values(allocations).reduce((sum, v) => sum + v, 0),
    budgetUsed: 100,
    sectionsInfo: tokenCounts.map(s => ({
      name: s.name,
      allocated: allocations[s.name],
      used: Math.min(s.currentTokens, allocations[s.name]),
      truncated: s.currentTokens > allocations[s.name],
    })),
  };

  return result;
}
