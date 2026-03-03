import fs from 'fs';
import path from 'path';
import { NODE_CONFIG } from '../config/node';
import { getDb } from './local-db';
import { discoverAgents, readAgentFiles } from './openclaw-reader';

export interface SearchResult {
  type: 'memory' | 'file' | 'session';
  title: string;
  snippet: string;
  path?: string;
  agent_id?: string;
  score: number;
}

function extractSnippet(content: string, query: string, contextChars: number = 100): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerContent.indexOf(lowerQuery);
  if (idx === -1) return content.slice(0, contextChars * 2);
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(content.length, idx + query.length + contextChars);
  let snippet = content.slice(start, end).replace(/\n/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

function scoreMatch(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (lowerText === lowerQuery) return 100;
  if (lowerText.startsWith(lowerQuery)) return 90;
  if (lowerText.includes(lowerQuery)) return 70;
  return 0;
}

function searchAgentMemories(query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const agents = discoverAgents();
  const lowerQuery = query.toLowerCase();
  const memoryFiles = ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'MEMORY.md', 'HEARTBEAT.md', 'IDENTITY.md'];

  for (const agent of agents) {
    for (const filename of memoryFiles) {
      const filePath = path.join(agent.workspace, filename);
      try {
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.toLowerCase().includes(lowerQuery)) continue;

        const titleScore = scoreMatch(filename, query);
        const contentScore = scoreMatch(content, query);
        const score = Math.max(titleScore, contentScore);

        results.push({
          type: 'memory',
          title: `${agent.name} / ${filename}`,
          snippet: extractSnippet(content, query),
          path: path.relative(NODE_CONFIG.openclawDir, filePath),
          agent_id: agent.id,
          score,
        });
      } catch {}
    }
  }

  return results;
}

function searchFiles(query: string, dir: string, rootDir: string, results: SearchResult[], maxDepth: number = 5): void {
  if (maxDepth <= 0 || results.length >= 50) return;
  const lowerQuery = query.toLowerCase();

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= 50) break;
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        const nameScore = scoreMatch(entry.name, query);
        if (nameScore > 0) {
          results.push({
            type: 'file',
            title: entry.name + '/',
            snippet: `Directory: ${relativePath}`,
            path: relativePath,
            score: nameScore - 10,
          });
        }
        searchFiles(query, fullPath, rootDir, results, maxDepth - 1);
      } else if (entry.isFile()) {
        const nameScore = scoreMatch(entry.name, query);
        if (nameScore > 0) {
          results.push({
            type: 'file',
            title: entry.name,
            snippet: `File: ${relativePath}`,
            path: relativePath,
            score: nameScore,
          });
        }

        const ext = path.extname(entry.name).toLowerCase();
        const textExtensions = ['.md', '.txt', '.json', '.yaml', '.yml', '.ts', '.js', '.py', '.sh', '.toml', '.cfg', '.ini', '.csv', '.xml', '.html', '.css'];
        if (textExtensions.includes(ext)) {
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > 512 * 1024) continue;
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.toLowerCase().includes(lowerQuery)) {
              const contentScore = scoreMatch(content, query);
              const existing = results.find(r => r.path === relativePath);
              if (existing) {
                existing.snippet = extractSnippet(content, query);
                existing.score = Math.max(existing.score, contentScore);
              } else {
                results.push({
                  type: 'file',
                  title: entry.name,
                  snippet: extractSnippet(content, query),
                  path: relativePath,
                  score: contentScore,
                });
              }
            }
          } catch {}
        }
      }
    }
  } catch {}
}

function searchSessions(query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  try {
    const d = getDb();
    const sessions = d.prepare(`
      SELECT id, agent_id, agent_name, model, status, messages, tokens_in, tokens_out, started_at, ended_at
      FROM sessions
      ORDER BY created_at DESC
      LIMIT 200
    `).all() as any[];

    for (const session of sessions) {
      const searchable = [
        session.agent_name || '',
        session.agent_id || '',
        session.model || '',
        session.status || '',
      ].join(' ').toLowerCase();

      if (!searchable.includes(lowerQuery)) continue;

      const nameScore = scoreMatch(session.agent_name || '', query);
      const modelScore = scoreMatch(session.model || '', query);
      const score = Math.max(nameScore, modelScore, 50);

      results.push({
        type: 'session',
        title: `Session #${session.id} — ${session.agent_name || session.agent_id}`,
        snippet: `Model: ${session.model}, Status: ${session.status}, Messages: ${session.messages}, Started: ${session.started_at}`,
        agent_id: session.agent_id,
        score,
      });

      if (results.length >= 20) break;
    }
  } catch {}

  return results;
}

export function localSearch(query: string): { results: SearchResult[] } {
  if (!query || query.trim().length === 0) {
    return { results: [] };
  }

  const trimmedQuery = query.trim();
  const allResults: SearchResult[] = [];

  const memoryResults = searchAgentMemories(trimmedQuery);
  allResults.push(...memoryResults);

  const fileResults: SearchResult[] = [];
  searchFiles(trimmedQuery, NODE_CONFIG.openclawDir, NODE_CONFIG.openclawDir, fileResults);
  allResults.push(...fileResults);

  const sessionResults = searchSessions(trimmedQuery);
  allResults.push(...sessionResults);

  allResults.sort((a, b) => b.score - a.score);

  return { results: allResults.slice(0, 50) };
}
