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
        status         TEXT NOT NULL CHECK (status IN ('inbox', 'assigned', 'in_progress', 'review', 'done', 'waiting_on_human', 'blocked', 'archived')),
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_deliverables (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        uploaded_by TEXT NOT NULL,
        uploader_type TEXT NOT NULL CHECK (uploader_type IN ('agent', 'user')),
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        file_size INTEGER NOT NULL DEFAULT 0,
        storage_path TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS thread_subscriptions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL REFERENCES tenants(id),
        task_id         UUID NOT NULL REFERENCES tasks(id),
        subscriber_id   TEXT NOT NULL,
        subscriber_type TEXT NOT NULL CHECK (subscriber_type IN ('agent', 'user')),
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, task_id, subscriber_id)
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
    await client.query(`ALTER TABLE memory_entries ADD COLUMN IF NOT EXISTS embedding vector(1536)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_memory_embedding ON memory_entries USING hnsw (embedding vector_cosine_ops)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_memory_content_fts ON memory_entries USING gin(to_tsvector('english', content))`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_deliverables_tenant_task ON deliverables(tenant_id, task_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cron_jobs_tenant ON cron_jobs(tenant_id)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_records_tenant_agent_date ON usage_records(tenant_id, agent_id, date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(tenant_id, recipient_id, is_read)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_standups_tenant_date ON standups(tenant_id, date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_time ON audit_log(tenant_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_deliverables_task ON task_deliverables(tenant_id, task_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_thread_subs_task ON thread_subscriptions(tenant_id, task_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_thread_subs_subscriber ON thread_subscriptions(tenant_id, subscriber_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        url TEXT NOT NULL,
        events TEXT[] NOT NULL DEFAULT '{}',
        secret TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
        event TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        response_status INTEGER,
        response_body TEXT,
        success BOOLEAN DEFAULT false,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id)`);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_saas_admin BOOLEAN NOT NULL DEFAULT false`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS telegram_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
        bot_token_encrypted TEXT NOT NULL,
        bot_username TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS telegram_chat_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        chat_id TEXT NOT NULL,
        chat_type TEXT NOT NULL DEFAULT 'private',
        linked_by UUID REFERENCES users(id),
        notifications_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, chat_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_telegram_chat_links_tenant ON telegram_chat_links(tenant_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS telegram_notification_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        chat_id TEXT NOT NULL,
        message TEXT NOT NULL,
        sent BOOLEAN DEFAULT false,
        sent_at TIMESTAMPTZ,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_telegram_queue_unsent ON telegram_notification_queue(sent, created_at) WHERE sent = false`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        key TEXT NOT NULL,
        value TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, key)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tenant_settings ON tenant_settings(tenant_id, key)`);

    await client.query(`ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL CHECK (type IN ('deliverable', 'brief', 'research', 'protocol', 'checklist', 'note')),
        task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
        agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(tenant_id, type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_task ON documents(task_id) WHERE task_id IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_fts ON documents USING gin(to_tsvector('english', title || ' ' || content))`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS squad_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'agent')),
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_squad_messages_tenant ON squad_messages(tenant_id, created_at DESC)`);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
        ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
          CHECK (status IN ('inbox', 'assigned', 'in_progress', 'review', 'done', 'waiting_on_human', 'blocked', 'archived'));
      END $$
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS machine_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS machines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        ssh_port INT NOT NULL DEFAULT 22,
        ssh_user TEXT NOT NULL,
        ssh_auth_type TEXT NOT NULL CHECK (ssh_auth_type IN ('key', 'password')),
        ssh_credential_encrypted TEXT NOT NULL,
        group_id UUID REFERENCES machine_groups(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'unknown',
        last_ping TIMESTAMPTZ,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        account_sid TEXT NOT NULL,
        auth_token_encrypted TEXT NOT NULL,
        whatsapp_number TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#2563eb',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, name)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_tags (
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, tag_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        last_used_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        plan TEXT NOT NULL DEFAULT 'starter',
        status TEXT NOT NULL DEFAULT 'active',
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS board_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL DEFAULT '#2563eb',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, name)
      )
    `);

    await client.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_group_id UUID REFERENCES board_groups(id) ON DELETE SET NULL
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        action_type TEXT NOT NULL,
        payload JSONB,
        requested_by_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_approvals_tenant_status ON approvals(tenant_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_board_groups_tenant ON board_groups(tenant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_machines_tenant ON machines(tenant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_machine_groups_tenant ON machine_groups(tenant_id)`);

    // --- Skills Marketplace ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS skill_packs (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name         TEXT NOT NULL,
        slug         TEXT NOT NULL UNIQUE,
        description  TEXT,
        source_url   TEXT,
        is_builtin   BOOLEAN NOT NULL DEFAULT false,
        last_synced_at TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS skills (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        pack_id     UUID NOT NULL REFERENCES skill_packs(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        slug        TEXT NOT NULL,
        description TEXT,
        category    TEXT NOT NULL DEFAULT 'uncategorized',
        risk        TEXT NOT NULL DEFAULT 'safe' CHECK (risk IN ('safe','moderate','high')),
        tools_md    TEXT NOT NULL DEFAULT '',
        metadata    JSONB,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(pack_id, slug)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS installed_skills (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, skill_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_skills (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        skill_id   UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(agent_id, skill_id)
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_pack ON skills(pack_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_installed_skills_tenant ON installed_skills(tenant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id)`);

    // Seed built-in skill packs (idempotent)
    await client.query(`
      INSERT INTO skill_packs (name, slug, description, is_builtin) VALUES
        ('SquidJob Core Skills', 'squidjob/core-skills', 'Essential capabilities for AI agents — research, development, productivity, and data tools.', true),
        ('SquidJob Communication Skills', 'squidjob/communication-skills', 'Messaging, notification, and collaboration capabilities for AI agents.', true)
      ON CONFLICT (slug) DO NOTHING
    `);

    await client.query(`
      INSERT INTO skills (pack_id, name, slug, description, category, risk, tools_md)
      SELECT p.id, s.name, s.slug, s.description, s.category, s.risk, s.tools_md
      FROM skill_packs p
      CROSS JOIN (VALUES
        ('squidjob/core-skills', 'Web Search',     'web-search',     'Search the web for current information and retrieve relevant results.',                        'research',     'safe',     E'## Web Search Capability\nYou can search the web for current information. When asked to research a topic, use web search to retrieve relevant results. Summarise findings clearly and cite your sources with URLs.'),
        ('squidjob/core-skills', 'Deep Research',  'deep-research',  'Conduct multi-step research across multiple sources to build comprehensive reports.',          'research',     'moderate', E'## Deep Research Capability\nYou can conduct in-depth, multi-step research across multiple sources. Break complex research questions into sub-queries, synthesise information from multiple sources, identify contradictions, and produce structured research reports with citations.'),
        ('squidjob/core-skills', 'Code Review',    'code-review',    'Analyse code for bugs, security issues, style violations, and improvement opportunities.',    'development',  'safe',     E'## Code Review Capability\nYou can review code systematically. Check for: logic errors, security vulnerabilities (injection, XSS, CSRF, insecure dependencies), performance issues, code style/readability, and adherence to best practices. Provide actionable, specific feedback with line references.'),
        ('squidjob/core-skills', 'Code Execution', 'code-execution', 'Write and reason about executable code solutions to technical problems.',                     'development',  'moderate', E'## Code Execution Capability\nYou can write production-quality code in multiple languages. When solving technical problems: identify the approach, write clean code with comments, reason through edge cases, and verify logic step-by-step. Present code in properly formatted code blocks.'),
        ('squidjob/core-skills', 'Git Operations', 'git-operations', 'Reason about Git workflows, branch strategies, and version control best practices.',         'development',  'moderate', E'## Git Operations Capability\nYou can advise on and generate Git commands for common workflows: branching strategies, merging, rebasing, resolving conflicts, writing commit messages, and setting up CI/CD pipelines. Always explain the impact of destructive operations.'),
        ('squidjob/core-skills', 'File Operations','file-operations','Read, write, organise, and transform file content and directory structures.',                  'system',       'moderate', E'## File Operations Capability\nYou can reason about file operations including reading files, writing structured content, organising directory structures, and transforming file formats. When working with files, validate paths, handle errors gracefully, and never overwrite important files without confirmation.'),
        ('squidjob/core-skills', 'Data Analysis',  'data-analysis',  'Analyse datasets, identify patterns, compute statistics, and generate insights.',             'analytics',    'safe',     E'## Data Analysis Capability\nYou can analyse structured data to extract insights. This includes: descriptive statistics, trend analysis, anomaly detection, correlation analysis, and data quality assessment. Present findings with clear visualisation descriptions and actionable recommendations.'),
        ('squidjob/core-skills', 'CSV Processing', 'csv-processing', 'Parse, clean, transform, and summarise CSV and spreadsheet data.',                            'analytics',    'safe',     E'## CSV/Spreadsheet Processing Capability\nYou can process tabular data from CSV or spreadsheet formats. Tasks include: parsing headers, cleaning dirty data, filtering rows, aggregating columns, pivot operations, and generating summary reports. Handle encoding issues and large files efficiently.'),
        ('squidjob/core-skills', 'API Testing',    'api-testing',    'Design and reason about API test cases, request structures, and response validation.',        'development',  'safe',     E'## API Testing Capability\nYou can design comprehensive API test suites. For each endpoint, define: happy path tests, edge cases, error scenarios, authentication tests, and performance benchmarks. Generate test cases in common formats (Jest, Pytest, Postman collections) and interpret API responses to identify issues.'),
        ('squidjob/core-skills', 'Email Drafting', 'email-drafting', 'Compose professional emails for various business contexts and communication needs.',           'communication','safe',     E'## Email Drafting Capability\nYou can compose professional emails tailored to context. Match tone (formal/casual) to the recipient and purpose. Structure emails with clear subject lines, opening context, body with key points, and call-to-action. Review for clarity, brevity, and appropriate formality.'),
        ('squidjob/core-skills', 'Task Planning',  'task-planning',  'Break down complex goals into structured, actionable task hierarchies with priorities.',       'productivity', 'safe',     E'## Task Planning Capability\nYou can decompose complex goals into structured task plans. For each goal: identify milestones, break into actionable sub-tasks, estimate effort, identify dependencies, flag risks, and suggest a sequenced execution plan. Output in a structured format compatible with the project board.'),
        ('squidjob/core-skills', 'Documentation',  'documentation',  'Write, structure, and maintain technical and non-technical documentation.',                   'productivity', 'safe',     E'## Documentation Capability\nYou can write clear, structured documentation including: README files, API references, architecture decision records (ADRs), runbooks, user guides, and inline code comments. Use appropriate formatting (Markdown) and tailor detail level to the target audience.'),
        ('squidjob/core-skills', 'Security Audit', 'security-audit', 'Identify security vulnerabilities, misconfigurations, and compliance gaps in systems.',       'security',     'high',     E'## Security Audit Capability\nYou can conduct security audits of code, configurations, and architectures. Check for: OWASP Top 10 vulnerabilities, insecure dependencies (CVEs), secrets in code, misconfigured permissions, weak authentication, and compliance gaps (SOC2, GDPR). Produce a prioritised findings report with remediation steps.'),
        ('squidjob/core-skills', 'Screenshot',     'screenshot',     'Describe and reason about capturing visual snapshots of web pages or UI components.',         'system',       'moderate', E'## Screenshot Capability\nYou can reason about capturing and analysing screenshots of web pages and UI components. Describe what to capture, identify visual layout issues, compare before/after states, and extract text content from images. Use for documentation, QA verification, and visual regression testing.'),
        ('squidjob/core-skills', 'Database Query', 'database-query', 'Compose, optimise, and explain SQL queries and database operations.',                         'data',         'high',     E'## Database Query Capability\nYou can compose and optimise SQL queries for PostgreSQL and other databases. Tasks include: SELECT with complex JOINs, aggregations, window functions, CTEs, index optimisation, EXPLAIN analysis, schema design, and migration scripts. Always validate queries before suggesting execution on production data.')
      ) AS s(pack_slug, name, slug, description, category, risk, tools_md)
      WHERE p.slug = s.pack_slug
      ON CONFLICT (pack_id, slug) DO NOTHING
    `);

    await client.query(`
      INSERT INTO skills (pack_id, name, slug, description, category, risk, tools_md)
      SELECT p.id, s.name, s.slug, s.description, s.category, s.risk, s.tools_md
      FROM skill_packs p
      CROSS JOIN (VALUES
        ('squidjob/communication-skills', 'Slack Notify',       'slack-notify',     'Send structured notifications and messages to Slack channels via webhooks.',               'communication','safe',     E'## Slack Notification Capability\nYou can compose and send notifications to Slack channels. Format messages with Slack markdown (bold, code blocks, links), use appropriate channels for context, include relevant data, and avoid spamming. Structure important alerts with clear titles, details, and action items.'),
        ('squidjob/communication-skills', 'Telegram Notify',    'telegram-notify',  'Send messages and alerts to Telegram chats and channels.',                                 'communication','safe',     E'## Telegram Notification Capability\nYou can compose messages for Telegram delivery. Use Telegram markdown formatting, keep messages concise, include relevant context and links. For alerts, use clear severity indicators and provide next steps.'),
        ('squidjob/communication-skills', 'WhatsApp Send',      'whatsapp-send',    'Send WhatsApp messages via Twilio integration for business communications.',               'communication','moderate', E'## WhatsApp Communication Capability\nYou can compose WhatsApp messages for business use via the Twilio integration. Keep messages professional, clear, and concise. Include all necessary context since recipients may not have prior conversation history. Respect opt-in requirements and privacy regulations.'),
        ('squidjob/communication-skills', 'Standup Generation', 'standup-gen',      'Generate structured standup reports from agent activity logs and task updates.',           'productivity', 'safe',     E'## Standup Generation Capability\nYou can generate structured standup reports from activity data. Format reports with: What was completed, what is in progress, blockers, and upcoming work. Tailor language to be concise and relevant to the audience. Include metrics where available (tasks closed, time spent, etc.).'),
        ('squidjob/communication-skills', 'Calendar Events',    'calendar-events',  'Create and reason about scheduling calendar events and managing time blocks.',             'productivity', 'safe',     E'## Calendar Event Capability\nYou can reason about scheduling and calendar management. Tasks include: creating event descriptions, suggesting optimal meeting times, drafting calendar invites with agendas, identifying scheduling conflicts, and managing recurring events. Always include timezone context.'),
        ('squidjob/communication-skills', 'Email Parser',       'email-parser',     'Extract structured information, actions, and key data from email threads.',               'communication','safe',     E'## Email Parsing Capability\nYou can extract structured information from email content. Identify: action items, deadlines, key decisions, stakeholders, sentiment, and follow-up requirements. Output in structured format with priority classification and suggested next actions.')
      ) AS s(pack_slug, name, slug, description, category, risk, tools_md)
      WHERE p.slug = s.pack_slug
      ON CONFLICT (pack_id, slug) DO NOTHING
    `);

    // Enable RLS on all tenant-scoped tables
    const rlsTables = [
      'tenants', 'users', 'api_keys', 'agents', 'tasks', 'comments',
      'activities', 'sessions', 'memory_entries', 'deliverables', 'task_deliverables',
      'cron_jobs', 'usage_records', 'notifications', 'standups', 'audit_log',
      'thread_subscriptions', 'webhooks', 'webhook_deliveries',
      'telegram_configs', 'telegram_chat_links', 'telegram_notification_queue',
      'tenant_settings', 'documents', 'squad_messages',
      'machine_groups', 'machines', 'whatsapp_configs',
      'board_groups', 'approvals', 'tags', 'api_tokens', 'subscriptions'
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

    await client.query(
      `INSERT INTO tenant_settings (tenant_id, key, value) VALUES ($1, 'setup_completed', 'true') ON CONFLICT (tenant_id, key) DO NOTHING`,
      [tenantId]
    );

    await client.query('COMMIT');
    console.log('Demo users seeded successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Demo seed failed:', error);
  } finally {
    client.release();
  }
}
