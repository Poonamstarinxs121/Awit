import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { NODE_CONFIG } from '../config/node';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbDir = NODE_CONFIG.openclawDir;
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'squidjob-node.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      agent_id TEXT,
      agent_name TEXT,
      model TEXT,
      status TEXT,
      messages INTEGER,
      tokens_in INTEGER,
      tokens_out INTEGER,
      started_at TEXT,
      ended_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS costs (
      id INTEGER PRIMARY KEY,
      agent_id TEXT,
      agent_name TEXT,
      model TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      estimated_cost REAL,
      session_id INTEGER,
      recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY,
      agent_id TEXT,
      event_type TEXT,
      description TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS setup_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

export interface SessionRecord {
  id?: number;
  agent_id: string;
  agent_name: string;
  model: string;
  status: string;
  messages: number;
  tokens_in: number;
  tokens_out: number;
  started_at: string;
  ended_at?: string | null;
}

export interface CostRecord {
  agent_id: string;
  agent_name: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  estimated_cost: number;
  session_id?: number | null;
}

export interface ActivityRecord {
  agent_id: string;
  event_type: string;
  description: string;
  metadata?: string | null;
}

export function insertSession(session: SessionRecord): number {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO sessions (agent_id, agent_name, model, status, messages, tokens_in, tokens_out, started_at, ended_at)
    VALUES (@agent_id, @agent_name, @model, @status, @messages, @tokens_in, @tokens_out, @started_at, @ended_at)
  `);
  const result = stmt.run({
    agent_id: session.agent_id,
    agent_name: session.agent_name,
    model: session.model,
    status: session.status,
    messages: session.messages,
    tokens_in: session.tokens_in,
    tokens_out: session.tokens_out,
    started_at: session.started_at,
    ended_at: session.ended_at ?? null,
  });
  return Number(result.lastInsertRowid);
}

export function updateSession(id: number, updates: Partial<SessionRecord>): void {
  const d = getDb();
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };

  if (updates.status !== undefined) { fields.push('status = @status'); values.status = updates.status; }
  if (updates.messages !== undefined) { fields.push('messages = @messages'); values.messages = updates.messages; }
  if (updates.tokens_in !== undefined) { fields.push('tokens_in = @tokens_in'); values.tokens_in = updates.tokens_in; }
  if (updates.tokens_out !== undefined) { fields.push('tokens_out = @tokens_out'); values.tokens_out = updates.tokens_out; }
  if (updates.ended_at !== undefined) { fields.push('ended_at = @ended_at'); values.ended_at = updates.ended_at; }

  if (fields.length === 0) return;

  const stmt = d.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(values);
}

export function listSessions(filters?: {
  agent_id?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): { sessions: any[]; total: number } {
  const d = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters?.agent_id) {
    conditions.push('agent_id = @agent_id');
    params.agent_id = filters.agent_id;
  }
  if (filters?.status) {
    conditions.push('status = @status');
    params.status = filters.status;
  }
  if (filters?.from) {
    conditions.push('started_at >= @from_date');
    params.from_date = filters.from;
  }
  if (filters?.to) {
    conditions.push('started_at <= @to_date');
    params.to_date = filters.to;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const countStmt = d.prepare(`SELECT COUNT(*) as total FROM sessions ${where}`);
  const { total } = countStmt.get(params) as { total: number };

  const stmt = d.prepare(`SELECT * FROM sessions ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`);
  const sessions = stmt.all({ ...params, limit, offset });

  return { sessions, total };
}

export function insertCost(cost: CostRecord): number {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO costs (agent_id, agent_name, model, tokens_in, tokens_out, estimated_cost, session_id)
    VALUES (@agent_id, @agent_name, @model, @tokens_in, @tokens_out, @estimated_cost, @session_id)
  `);
  const result = stmt.run({
    agent_id: cost.agent_id,
    agent_name: cost.agent_name,
    model: cost.model,
    tokens_in: cost.tokens_in,
    tokens_out: cost.tokens_out,
    estimated_cost: cost.estimated_cost,
    session_id: cost.session_id ?? null,
  });
  return Number(result.lastInsertRowid);
}

export function getCostSummary(filters?: {
  agent_id?: string;
  model?: string;
  from?: string;
  to?: string;
}): {
  total_cost: number;
  total_tokens_in: number;
  total_tokens_out: number;
  by_agent: any[];
  by_model: any[];
} {
  const d = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters?.agent_id) {
    conditions.push('agent_id = @agent_id');
    params.agent_id = filters.agent_id;
  }
  if (filters?.model) {
    conditions.push('model = @model');
    params.model = filters.model;
  }
  if (filters?.from) {
    conditions.push('recorded_at >= @from_date');
    params.from_date = filters.from;
  }
  if (filters?.to) {
    conditions.push('recorded_at <= @to_date');
    params.to_date = filters.to;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalStmt = d.prepare(`
    SELECT COALESCE(SUM(estimated_cost), 0) as total_cost,
           COALESCE(SUM(tokens_in), 0) as total_tokens_in,
           COALESCE(SUM(tokens_out), 0) as total_tokens_out
    FROM costs ${where}
  `);
  const totals = totalStmt.get(params) as { total_cost: number; total_tokens_in: number; total_tokens_out: number };

  const byAgentStmt = d.prepare(`
    SELECT agent_id, agent_name,
           SUM(estimated_cost) as total_cost,
           SUM(tokens_in) as total_tokens_in,
           SUM(tokens_out) as total_tokens_out,
           COUNT(*) as record_count
    FROM costs ${where}
    GROUP BY agent_id, agent_name
    ORDER BY total_cost DESC
  `);
  const by_agent = byAgentStmt.all(params);

  const byModelStmt = d.prepare(`
    SELECT model,
           SUM(estimated_cost) as total_cost,
           SUM(tokens_in) as total_tokens_in,
           SUM(tokens_out) as total_tokens_out,
           COUNT(*) as record_count
    FROM costs ${where}
    GROUP BY model
    ORDER BY total_cost DESC
  `);
  const by_model = byModelStmt.all(params);

  return {
    total_cost: totals.total_cost,
    total_tokens_in: totals.total_tokens_in,
    total_tokens_out: totals.total_tokens_out,
    by_agent,
    by_model,
  };
}

export function insertActivity(activity: ActivityRecord): number {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO activity (agent_id, event_type, description, metadata)
    VALUES (@agent_id, @event_type, @description, @metadata)
  `);
  const result = stmt.run({
    agent_id: activity.agent_id,
    event_type: activity.event_type,
    description: activity.description,
    metadata: activity.metadata ?? null,
  });
  return Number(result.lastInsertRowid);
}

export function getSyncState(key: string): string | null {
  const d = getDb();
  const row = d.prepare('SELECT value FROM sync_state WHERE key = @key').get({ key }) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSyncState(key: string, value: string): void {
  const d = getDb();
  d.prepare('INSERT OR REPLACE INTO sync_state (key, value) VALUES (@key, @value)').run({ key, value });
}

export function getSessionsSince(since: string): any[] {
  const d = getDb();
  return d.prepare('SELECT * FROM sessions WHERE created_at > @since ORDER BY created_at ASC').all({ since });
}

export function getCostsSince(since: string): any[] {
  const d = getDb();
  return d.prepare('SELECT * FROM costs WHERE recorded_at > @since ORDER BY recorded_at ASC').all({ since });
}

export function getActivitySince(since: string): any[] {
  const d = getDb();
  return d.prepare('SELECT * FROM activity WHERE created_at > @since ORDER BY created_at ASC').all({ since });
}

export function listActivity(filters?: {
  agent_id?: string;
  event_type?: string;
  limit?: number;
  offset?: number;
}): { activities: any[]; total: number } {
  const d = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters?.agent_id) {
    conditions.push('agent_id = @agent_id');
    params.agent_id = filters.agent_id;
  }
  if (filters?.event_type) {
    conditions.push('event_type = @event_type');
    params.event_type = filters.event_type;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const countStmt = d.prepare(`SELECT COUNT(*) as total FROM activity ${where}`);
  const { total } = countStmt.get(params) as { total: number };

  const stmt = d.prepare(`SELECT * FROM activity ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`);
  const activities = stmt.all({ ...params, limit, offset });

  return { activities, total };
}

export function getSetupConfig(key: string): string | null {
  const d = getDb();
  const row = d.prepare('SELECT value FROM setup_config WHERE key = @key').get({ key }) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetupConfig(key: string, value: string): void {
  const d = getDb();
  d.prepare('INSERT OR REPLACE INTO setup_config (key, value, updated_at) VALUES (@key, @value, CURRENT_TIMESTAMP)').run({ key, value });
}

export function getAllSetupConfig(): Record<string, string> {
  const d = getDb();
  const rows = d.prepare('SELECT key, value FROM setup_config').all() as { key: string; value: string }[];
  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return config;
}

export function clearSetupComplete(): void {
  const d = getDb();
  d.prepare("DELETE FROM setup_config WHERE key = 'setup_complete'").run();
}

export function isSetupComplete(): boolean {
  return getSetupConfig('setup_complete') === 'true';
}
