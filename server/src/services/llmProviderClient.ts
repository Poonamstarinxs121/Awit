import crypto from 'crypto';
import OpenAI from 'openai';
import { pool } from '../db/index.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'squidjob-dev-encryption-key-32b!';
const ALGORITHM = 'aes-256-cbc';

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: string;
}

interface ModelConfig {
  provider: string;
  model: string;
  temperature: number;
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  'gpt-4-turbo': { input: 10 / 1_000_000, output: 30 / 1_000_000 },
  'gpt-3.5-turbo': { input: 0.5 / 1_000_000, output: 1.5 / 1_000_000 },
  'claude-3-5-sonnet-20241022': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  'claude-3-haiku-20240307': { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 },
};

async function getApiKey(tenantId: string, provider: string): Promise<string> {
  const result = await pool.query(
    `SELECT encrypted_key FROM api_keys WHERE tenant_id = $1 AND provider = $2 AND is_active = true`,
    [tenantId, provider]
  );

  if (result.rows.length === 0) {
    throw new Error(`No active API key found for provider "${provider}". Please add your API key in Settings > API Providers.`);
  }

  return decrypt(result.rows[0].encrypted_key);
}

function createOpenAIClient(apiKey: string, provider: string): OpenAI {
  if (provider === 'anthropic') {
    return new OpenAI({
      apiKey,
      baseURL: 'https://api.anthropic.com/v1/',
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
      },
    });
  }

  return new OpenAI({ apiKey });
}

export async function chatCompletion(
  tenantId: string,
  agentId: string,
  messages: ChatMessage[],
  modelConfig: ModelConfig
): Promise<LLMResponse> {
  const provider = modelConfig.provider || 'openai';
  const model = modelConfig.model || 'gpt-4o';
  const temperature = modelConfig.temperature ?? 0.7;

  const apiKey = await getApiKey(tenantId, provider);
  const client = createOpenAIClient(apiKey, provider);

  const completion = await client.chat.completions.create({
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: 4096,
  });

  const choice = completion.choices[0];
  const content = choice?.message?.content || '';
  const tokensIn = completion.usage?.prompt_tokens || 0;
  const tokensOut = completion.usage?.completion_tokens || 0;

  await trackUsage(tenantId, agentId, model, tokensIn, tokensOut);

  return {
    content,
    tokensIn,
    tokensOut,
    model,
    provider,
  };
}

export async function chatCompletionStream(
  tenantId: string,
  agentId: string,
  messages: ChatMessage[],
  modelConfig: ModelConfig,
  onChunk: (chunk: string) => void
): Promise<LLMResponse> {
  const provider = modelConfig.provider || 'openai';
  const model = modelConfig.model || 'gpt-4o';
  const temperature = modelConfig.temperature ?? 0.7;

  const apiKey = await getApiKey(tenantId, provider);
  const client = createOpenAIClient(apiKey, provider);

  const stream = await client.chat.completions.create({
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: 4096,
    stream: true,
  });

  let fullContent = '';
  let tokensIn = 0;
  let tokensOut = 0;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      fullContent += delta;
      onChunk(delta);
    }
    if (chunk.usage) {
      tokensIn = chunk.usage.prompt_tokens || 0;
      tokensOut = chunk.usage.completion_tokens || 0;
    }
  }

  if (tokensIn === 0) {
    tokensIn = estimateTokens(messages.map(m => m.content).join(' '));
  }
  if (tokensOut === 0) {
    tokensOut = estimateTokens(fullContent);
  }

  await trackUsage(tenantId, agentId, model, tokensIn, tokensOut);

  return {
    content: fullContent,
    tokensIn,
    tokensOut,
    model,
    provider,
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function trackUsage(
  tenantId: string,
  agentId: string,
  model: string,
  tokensIn: number,
  tokensOut: number
): Promise<void> {
  const pricing = MODEL_PRICING[model] || { input: 5 / 1_000_000, output: 15 / 1_000_000 };
  const estimatedCost = tokensIn * pricing.input + tokensOut * pricing.output;

  try {
    await pool.query(
      `INSERT INTO usage_records (tenant_id, agent_id, date, tokens_in, tokens_out, api_calls, estimated_cost)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, 1, $5)
       ON CONFLICT (tenant_id, agent_id, date)
       DO UPDATE SET
         tokens_in = usage_records.tokens_in + EXCLUDED.tokens_in,
         tokens_out = usage_records.tokens_out + EXCLUDED.tokens_out,
         api_calls = usage_records.api_calls + 1,
         estimated_cost = usage_records.estimated_cost + EXCLUDED.estimated_cost`,
      [tenantId, agentId, tokensIn, tokensOut, estimatedCost]
    );
  } catch (error) {
    console.error('Failed to track usage:', error);
  }
}

export async function validateApiKey(provider: string, apiKey: string): Promise<boolean> {
  try {
    const client = createOpenAIClient(apiKey, provider);
    await client.models.list();
    return true;
  } catch {
    return false;
  }
}
