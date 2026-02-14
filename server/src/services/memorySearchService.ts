import { pool } from '../db/index.js';
import crypto from 'crypto';
import OpenAI from 'openai';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'squidjob-dev-encryption-key-32b!';

interface MemorySearchResult {
  id: string;
  memory_type: string;
  content: string;
  score: number;
  source: 'bm25' | 'vector' | 'fused';
}

async function bm25Search(tenantId: string, agentId: string, query: string, limit: number = 10): Promise<MemorySearchResult[]> {
  const result = await pool.query(
    `SELECT id, memory_type, content,
            ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', $3)) as score
     FROM memory_entries
     WHERE tenant_id = $1 AND agent_id = $2
       AND to_tsvector('english', content) @@ plainto_tsquery('english', $3)
     ORDER BY score DESC
     LIMIT $4`,
    [tenantId, agentId, query, limit]
  );
  return result.rows.map((r: any) => ({ ...r, score: parseFloat(r.score), source: 'bm25' as const }));
}

async function vectorSearch(tenantId: string, agentId: string, queryEmbedding: number[], limit: number = 10): Promise<MemorySearchResult[]> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  const result = await pool.query(
    `SELECT id, memory_type, content,
            1 - (embedding <=> $3::vector) as score
     FROM memory_entries
     WHERE tenant_id = $1 AND agent_id = $2 AND embedding IS NOT NULL
     ORDER BY embedding <=> $3::vector
     LIMIT $4`,
    [tenantId, agentId, embeddingStr, limit]
  );
  return result.rows.map((r: any) => ({ ...r, score: parseFloat(r.score), source: 'vector' as const }));
}

function reciprocalRankFusion(bm25Results: MemorySearchResult[], vectorResults: MemorySearchResult[], k: number = 60): MemorySearchResult[] {
  const scores = new Map<string, { result: MemorySearchResult; score: number }>();

  bm25Results.forEach((result, rank) => {
    const rrf = 1 / (k + rank + 1);
    const existing = scores.get(result.id);
    if (existing) {
      existing.score += rrf;
    } else {
      scores.set(result.id, { result: { ...result, source: 'fused' }, score: rrf });
    }
  });

  vectorResults.forEach((result, rank) => {
    const rrf = 1 / (k + rank + 1);
    const existing = scores.get(result.id);
    if (existing) {
      existing.score += rrf;
    } else {
      scores.set(result.id, { result: { ...result, source: 'fused' }, score: rrf });
    }
  });

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(({ result, score }) => ({ ...result, score }));
}

async function generateEmbedding(tenantId: string, text: string): Promise<number[] | null> {
  try {
    const keyResult = await pool.query(
      `SELECT encrypted_key FROM api_keys WHERE tenant_id = $1 AND provider = 'openai' AND is_active = true`,
      [tenantId]
    );
    if (keyResult.rows.length === 0) return null;

    const [ivHex, encrypted] = keyResult.rows[0].encrypted_key.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const openai = new OpenAI({ apiKey: decrypted });
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function saveMemoryWithEmbedding(
  tenantId: string,
  agentId: string,
  memoryType: string,
  content: string
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO memory_entries (tenant_id, agent_id, memory_type, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [tenantId, agentId, memoryType, content]
  );
  const memoryId = result.rows[0].id;

  generateEmbedding(tenantId, content).then(async (embedding) => {
    if (embedding) {
      const embeddingStr = `[${embedding.join(',')}]`;
      await pool.query(
        `UPDATE memory_entries SET embedding = $1::vector WHERE id = $2`,
        [embeddingStr, memoryId]
      );
    }
  }).catch(err => console.error('Failed to save embedding:', err));

  return memoryId;
}

export async function hybridMemorySearch(
  tenantId: string,
  agentId: string,
  query: string,
  limit: number = 5
): Promise<MemorySearchResult[]> {
  const bm25Results = await bm25Search(tenantId, agentId, query, limit * 2);

  const queryEmbedding = await generateEmbedding(tenantId, query);

  if (queryEmbedding) {
    const vectorResults = await vectorSearch(tenantId, agentId, queryEmbedding, limit * 2);
    const fusedResults = reciprocalRankFusion(bm25Results, vectorResults);
    return fusedResults.slice(0, limit);
  }

  return bm25Results.slice(0, limit);
}

export async function loadRecentMemories(tenantId: string, agentId: string, limit: number = 10): Promise<MemorySearchResult[]> {
  const result = await pool.query(
    `SELECT id, memory_type, content, 1.0 as score
     FROM memory_entries
     WHERE tenant_id = $1 AND agent_id = $2
     ORDER BY updated_at DESC LIMIT $3`,
    [tenantId, agentId, limit]
  );
  return result.rows.map((r: any) => ({ ...r, score: parseFloat(r.score), source: 'fused' as const }));
}
