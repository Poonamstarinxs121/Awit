import { pool } from './index.js';
import bcrypt from 'bcryptjs';
import { seedDefaultAgents } from '../services/agentService.js';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    } catch {
      console.warn('pgvector extension not available, skipping');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name       TEXT NOT NULL,
        plan       TEXT NOT NULL CHECK (plan IN ('starter', 'professional', 'enterprise')),
        settings   JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email         TEXT NOT NULL,
        name          TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, email)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        provider      TEXT NOT NULL,
        encrypted_key TEXT NOT NULL,
        is_active     BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        role         TEXT NOT NULL,
        soul_md      TEXT NOT NULL,
        agents_md    TEXT NOT NULL DEFAULT '',
        tools_md     TEXT NOT NULL DEFAULT '',
        heartbeat_md TEXT NOT NULL DEFAULT '',
        model_config JSONB NOT NULL DEFAULT '{}',
        level        TEXT NOT NULL CHECK (level IN ('intern', 'specialist', 'lead')),
        status       TEXT NOT NULL CHECK (status IN ('active', 'idle', 'error', 'disabled')),
        is_default   BOOLEAN NOT NULL DEFAULT false,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        title          TEXT NOT NULL,
        description    TEXT NOT NULL DEFAULT '',
        status         TEXT NOT NULL CHECK (status IN ('inbox', 'assigned', 'in_progress', 'review', 'done')),
        is_blocked     BOOLEAN NOT NULL DEFAULT false,
        blocker_reason TEXT,
        blocked_by     TEXT,
        blocked_at     TIMESTAMPTZ,
        blocked_until  TIMESTAMPTZ,
        unblock_owner  TEXT,
        priority       TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
        assignees      UUID[] NOT NULL DEFAULT '{}',
        created_by     TEXT NOT NULL,
        parent_task    UUID REFERENCES tasks(id) ON DELETE SET NULL,
        tags           TEXT[] NOT NULL DEFAULT '{}',
        due_date       TIMESTAMPTZ,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        author_id         TEXT NOT NULL,
        content           TEXT NOT NULL,
        mentions          TEXT[] NOT NULL DEFAULT '{}',
        parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        actor_id    TEXT NOT NULL,
        action      TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id   TEXT NOT NULL,
        metadata    JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        agent_id            UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        session_key         TEXT NOT NULL,
        conversation_buffer TEXT NOT NULL DEFAULT '[]',
        compaction_summary  TEXT,
        token_count         INTEGER NOT NULL DEFAULT 0,
        model_config        JSONB NOT NULL DEFAULT '{}',
        status              TEXT NOT NULL CHECK (status IN ('active', 'idle', 'archived')),
        last_active_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        memory_type TEXT NOT NULL CHECK (memory_type IN ('long_term', 'working', 'daily_note')),
        content     TEXT NOT NULL,
        date        DATE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS deliverables (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        file_name  TEXT NOT NULL,
        file_ref   TEXT NOT NULL,
        mime_type  TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        schedule        TEXT NOT NULL,
        schedule_type   TEXT NOT NULL CHECK (schedule_type IN ('cron', 'at', 'interval')),
        execution_mode  TEXT NOT NULL CHECK (execution_mode IN ('main_session', 'isolated')),
        command         TEXT NOT NULL,
        model_override  TEXT,
        is_active       BOOLEAN NOT NULL DEFAULT true,
        last_run_at     TIMESTAMPTZ,
        next_run_at     TIMESTAMPTZ,
        retry_count     INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS usage_records (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        date           DATE NOT NULL,
        tokens_in      INTEGER NOT NULL DEFAULT 0,
        tokens_out     INTEGER NOT NULL DEFAULT 0,
        api_calls      INTEGER NOT NULL DEFAULT 0,
        estimated_cost NUMERIC(12, 6) NOT NULL DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        recipient_id      TEXT NOT NULL,
        recipient_type    TEXT NOT NULL CHECK (recipient_type IN ('agent', 'user')),
        type              TEXT NOT NULL CHECK (type IN ('mention', 'assignment', 'review_request', 'status_change', 'standup')),
        source_task_id    UUID REFERENCES tasks(id) ON DELETE SET NULL,
        source_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
        message           TEXT NOT NULL,
        is_read           BOOLEAN NOT NULL DEFAULT false,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS standups (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        date                DATE NOT NULL,
        summary             TEXT NOT NULL,
        per_agent_summaries JSONB NOT NULL DEFAULT '[]',
        delivered_to        TEXT[] NOT NULL DEFAULT '{}',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        actor_id    TEXT NOT NULL,
        action      TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id   TEXT NOT NULL,
        metadata    JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_tenant_provider ON api_keys(tenant_id, provider)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agents_tenant_status ON agents(tenant_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status ON tasks(tenant_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comments_tenant_task ON comments(tenant_id, task_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activities_tenant_time ON activities(tenant_id, created_at DESC)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_key ON sessions(session_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_tenant_agent ON sessions(tenant_id, agent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(tenant_id, last_active_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_memory_entries_agent_type ON memory_entries(tenant_id, agent_id, memory_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_deliverables_tenant_task ON deliverables(tenant_id, task_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cron_jobs_tenant ON cron_jobs(tenant_id)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_records_tenant_agent_date ON usage_records(tenant_id, agent_id, date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(tenant_id, recipient_id, is_read)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_standups_tenant_date ON standups(tenant_id, date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_time ON audit_log(tenant_id, created_at DESC)`);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_saas_admin BOOLEAN NOT NULL DEFAULT false`);

    // Enable RLS on all tenant-scoped tables
    const rlsTables = [
      'tenants', 'users', 'api_keys', 'agents', 'tasks', 'comments',
      'activities', 'sessions', 'memory_entries', 'deliverables',
      'cron_jobs', 'usage_records', 'notifications', 'standups', 'audit_log'
    ];

    for (const table of rlsTables) {
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);

      const policyColumn = table === 'tenants' ? 'id' : 'tenant_id';
      const policyName = `tenant_isolation_${table}`;

      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = '${table}' AND policyname = '${policyName}'
          ) THEN
            CREATE POLICY ${policyName} ON ${table}
              USING (${policyColumn}::text = current_setting('app.tenant_id', true));
          END IF;
        END $$
      `);
    }

    await client.query('COMMIT');
    console.log('Migrations completed successfully');

    await seedDemoUsers();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function seedDemoUsers(): Promise<void> {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT COUNT(*)::int as count FROM users');
    if (existing.rows[0].count > 0) {
      console.log('Users already exist, skipping demo seed');
      return;
    }

    await client.query('BEGIN');

    const tenantResult = await client.query(
      `INSERT INTO tenants (name, plan) VALUES ('Awit Media', 'starter') RETURNING id`
    );
    const tenantId = tenantResult.rows[0].id;

    const adminHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (tenant_id, email, name, password_hash, role, is_saas_admin) VALUES ($1, $2, $3, $4, 'owner', true)`,
      [tenantId, 'admin@squidjob.com', 'SquidJob Admin', adminHash]
    );

    const memberHash = await bcrypt.hash('member123', 10);
    await client.query(
      `INSERT INTO users (tenant_id, email, name, password_hash, role, is_saas_admin) VALUES ($1, $2, $3, $4, 'owner', false)`,
      [tenantId, 'kaustubh@awitmedia.com', 'Kaustubh', memberHash]
    );

    await seedDefaultAgents(tenantId, client);

    await client.query('COMMIT');
    console.log('Demo users seeded successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Demo seed failed:', error);
  } finally {
    client.release();
  }
}
