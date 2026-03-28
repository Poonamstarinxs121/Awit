-- ============================================================================
-- SquidJob Production Schema
-- Complete database schema, indexes, RLS policies, and seed data
-- Target: PostgreSQL 16+ with pgvector extension
-- Usage: psql -U <user> -d <database> -f schema.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  plan       TEXT NOT NULL CHECK (plan IN ('starter', 'professional', 'enterprise')),
  settings   JSONB NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
  subdomain  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  is_saas_admin BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  is_paused    BOOLEAN DEFAULT false,
  manager_id   UUID REFERENCES agents(id) ON DELETE SET NULL,
  job_title    TEXT,
  department   TEXT,
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  board_group_id UUID,
  target_node_id UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id         TEXT NOT NULL,
  content           TEXT NOT NULL,
  mentions          TEXT[] NOT NULL DEFAULT '{}',
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('long_term', 'working', 'daily_note')),
  content     TEXT NOT NULL,
  date        DATE,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
);

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
);

CREATE TABLE IF NOT EXISTS usage_records (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  tokens_in      INTEGER NOT NULL DEFAULT 0,
  tokens_out     INTEGER NOT NULL DEFAULT 0,
  api_calls      INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12, 6) NOT NULL DEFAULT 0
);

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
);

CREATE TABLE IF NOT EXISTS standups (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  summary             TEXT NOT NULL,
  per_agent_summaries JSONB NOT NULL DEFAULT '[]',
  delivered_to        TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_deliverables (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by       TEXT NOT NULL,
  uploader_type     TEXT NOT NULL CHECK (uploader_type IN ('agent', 'user')),
  filename          TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type         TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size         INTEGER NOT NULL DEFAULT 0,
  storage_path      TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS thread_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  task_id         UUID NOT NULL REFERENCES tasks(id),
  subscriber_id   TEXT NOT NULL,
  subscriber_type TEXT NOT NULL CHECK (subscriber_type IN ('agent', 'user')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, task_id, subscriber_id)
);

-- ============================================================================
-- 3. WEBHOOK TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  url        TEXT NOT NULL,
  events     TEXT[] NOT NULL DEFAULT '{}',
  secret     TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  webhook_id      UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  response_status INTEGER,
  response_body   TEXT,
  success         BOOLEAN DEFAULT false,
  attempts        INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. MESSAGING & INTEGRATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS telegram_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  bot_token_encrypted TEXT NOT NULL,
  bot_username        TEXT,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_chat_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  chat_id               TEXT NOT NULL,
  chat_type             TEXT NOT NULL DEFAULT 'private',
  linked_by             UUID REFERENCES users(id),
  notifications_enabled BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, chat_id)
);

CREATE TABLE IF NOT EXISTS telegram_notification_queue (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  chat_id    TEXT NOT NULL,
  message    TEXT NOT NULL,
  sent       BOOLEAN DEFAULT false,
  sent_at    TIMESTAMPTZ,
  error      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_configs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_sid            TEXT NOT NULL,
  auth_token_encrypted   TEXT NOT NULL,
  whatsapp_number        TEXT NOT NULL,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

-- ============================================================================
-- 5. SETTINGS & CONFIG TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  key             TEXT NOT NULL,
  value           TEXT NOT NULL DEFAULT '',
  setup_completed BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, key)
);

-- ============================================================================
-- 6. CALENDAR & DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT DEFAULT '',
  event_type       TEXT NOT NULL DEFAULT 'event'
    CHECK (event_type IN ('meeting', 'followup', 'reminder', 'task', 'event')),
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ,
  all_day          BOOLEAN DEFAULT false,
  color            TEXT,
  related_task_id  UUID REFERENCES tasks(id) ON DELETE SET NULL,
  related_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL CHECK (type IN ('deliverable', 'brief', 'research', 'protocol', 'checklist', 'note')),
  task_id    UUID REFERENCES tasks(id) ON DELETE SET NULL,
  agent_id   UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS squad_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'agent')),
  sender_id   TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. SSH & MACHINE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS machine_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machines (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  host                     TEXT NOT NULL,
  ssh_port                 INT NOT NULL DEFAULT 22,
  ssh_user                 TEXT NOT NULL,
  ssh_auth_type            TEXT NOT NULL CHECK (ssh_auth_type IN ('key', 'password')),
  ssh_credential_encrypted TEXT NOT NULL,
  group_id                 UUID REFERENCES machine_groups(id) ON DELETE SET NULL,
  status                   TEXT NOT NULL DEFAULT 'unknown',
  last_ping                TIMESTAMPTZ,
  description              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. TAGS & BOARD GROUPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#2563eb',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  plan                   TEXT NOT NULL DEFAULT 'starter',
  status                 TEXT NOT NULL DEFAULT 'active',
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS board_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#2563eb',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS approvals (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title                  TEXT NOT NULL,
  description            TEXT,
  action_type            TEXT NOT NULL,
  payload                JSONB,
  requested_by_agent_id  UUID REFERENCES agents(id) ON DELETE SET NULL,
  status                 TEXT NOT NULL DEFAULT 'pending',
  reviewed_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at            TIMESTAMPTZ,
  expires_at             TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. SKILLS MARKETPLACE
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_packs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  description    TEXT,
  source_url     TEXT,
  is_builtin     BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pack_id     UUID NOT NULL REFERENCES skill_packs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'uncategorized',
  risk        TEXT NOT NULL DEFAULT 'safe' CHECK (risk IN ('safe', 'moderate', 'high')),
  tools_md    TEXT NOT NULL DEFAULT '',
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pack_id, slug)
);

CREATE TABLE IF NOT EXISTS installed_skills (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, skill_id)
);

CREATE TABLE IF NOT EXISTS agent_skills (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id   UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, skill_id)
);

-- ============================================================================
-- 10. FLEET / NODE TABLES (Hub+Node Architecture)
-- ============================================================================

CREATE TABLE IF NOT EXISTS nodes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  url              TEXT,
  api_key_hash     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'degraded')),
  last_heartbeat   TIMESTAMPTZ,
  system_info      JSONB DEFAULT '{}',
  openclaw_version TEXT,
  agent_count      INTEGER DEFAULT 0,
  deleted_at       TIMESTAMPTZ,
  deleted_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  deletion_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deleted_nodes_history (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  node_id          UUID NOT NULL,
  name             TEXT NOT NULL,
  url              TEXT,
  system_info      JSONB DEFAULT '{}',
  openclaw_version TEXT,
  agent_count      INTEGER DEFAULT 0,
  deleted_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  deletion_reason  TEXT,
  deleted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  can_restore_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS node_heartbeats (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id        UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  cpu_percent    REAL,
  memory_percent REAL,
  disk_percent   REAL,
  uptime_seconds INTEGER,
  agent_statuses JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS node_telemetry (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id        UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  telemetry_type TEXT NOT NULL CHECK (telemetry_type IN ('session', 'cost', 'activity')),
  payload        JSONB NOT NULL DEFAULT '{}',
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS board_memories (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  board_group_id UUID REFERENCES board_groups(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  memory_type    TEXT NOT NULL DEFAULT 'note' CHECK (memory_type IN ('note', 'decision', 'context', 'reference')),
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. TASK DISPATCH (Phase 3)
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_dispatches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  node_id       UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'accepted', 'running', 'completed', 'failed')),
  dispatched_at TIMESTAMPTZ,
  accepted_at   TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  result        JSONB,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 12. NODE-TO-NODE MESSAGING (Phase 4)
-- ============================================================================

CREATE TABLE IF NOT EXISTS node_messages (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  message_type   TEXT NOT NULL CHECK (message_type IN ('agent_request', 'search_request', 'status_request', 'custom')),
  payload        JSONB NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'processed', 'failed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 13. ADD FOREIGN KEYS DEFERRED (tasks -> board_groups, tasks -> nodes)
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_board_group_id_fkey' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_board_group_id_fkey
      FOREIGN KEY (board_group_id) REFERENCES board_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_target_node_id_fkey' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_target_node_id_fkey
      FOREIGN KEY (target_node_id) REFERENCES nodes(id);
  END IF;
END $$;

-- ============================================================================
-- 14. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_tenant_provider ON api_keys(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_tenant_status ON agents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_comments_tenant_task ON comments(tenant_id, task_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_time ON activities(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_key ON sessions(session_key);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_agent ON sessions(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(tenant_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_entries_agent_type ON memory_entries(tenant_id, agent_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_embedding ON memory_entries USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_memory_content_fts ON memory_entries USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_deliverables_tenant_task ON deliverables(tenant_id, task_id);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_tenant ON cron_jobs(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_records_tenant_agent_date ON usage_records(tenant_id, agent_id, date);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(tenant_id, recipient_id, is_read);
CREATE UNIQUE INDEX IF NOT EXISTS idx_standups_tenant_date ON standups(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_time ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_deliverables_task ON task_deliverables(tenant_id, task_id);
CREATE INDEX IF NOT EXISTS idx_thread_subs_task ON thread_subscriptions(tenant_id, task_id);
CREATE INDEX IF NOT EXISTS idx_thread_subs_subscriber ON thread_subscriptions(tenant_id, subscriber_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_telegram_chat_links_tenant ON telegram_chat_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_telegram_queue_unsent ON telegram_notification_queue(sent, created_at) WHERE sent = false;
CREATE INDEX IF NOT EXISTS idx_tenant_settings ON tenant_settings(tenant_id, key);
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant ON calendar_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_range ON calendar_events(tenant_id, start_at);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_documents_task ON documents(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_fts ON documents USING gin(to_tsvector('english', title || ' ' || content));
CREATE INDEX IF NOT EXISTS idx_squad_messages_tenant ON squad_messages(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_tenant_status ON approvals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_board_groups_tenant ON board_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_machines_tenant ON machines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_machine_groups_tenant ON machine_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skills_pack ON skills(pack_id);
CREATE INDEX IF NOT EXISTS idx_installed_skills_tenant ON installed_skills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_tenant ON nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_node_heartbeats_node ON node_heartbeats(node_id);
CREATE INDEX IF NOT EXISTS idx_node_heartbeats_created ON node_heartbeats(created_at);
CREATE INDEX IF NOT EXISTS idx_node_telemetry_node ON node_telemetry(node_id);
CREATE INDEX IF NOT EXISTS idx_node_telemetry_type ON node_telemetry(telemetry_type);
CREATE INDEX IF NOT EXISTS idx_board_memories_tenant ON board_memories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_board_memories_board_group ON board_memories(board_group_id);
CREATE INDEX IF NOT EXISTS idx_task_dispatches_node ON task_dispatches(node_id);
CREATE INDEX IF NOT EXISTS idx_task_dispatches_task ON task_dispatches(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dispatches_status ON task_dispatches(status);
CREATE INDEX IF NOT EXISTS idx_node_messages_target ON node_messages(target_node_id, status);

-- ============================================================================
-- 15. ROW LEVEL SECURITY (RLS)
-- ============================================================================

DO $$ 
DECLARE
  tbl TEXT;
  pol TEXT;
  col TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'tenants', 'users', 'api_keys', 'agents', 'tasks', 'comments',
    'activities', 'sessions', 'memory_entries', 'deliverables', 'task_deliverables',
    'cron_jobs', 'usage_records', 'notifications', 'standups', 'audit_log',
    'thread_subscriptions', 'webhooks', 'webhook_deliveries',
    'telegram_configs', 'telegram_chat_links', 'telegram_notification_queue',
    'tenant_settings', 'documents', 'squad_messages',
    'machine_groups', 'machines', 'whatsapp_configs',
    'board_groups', 'approvals', 'tags', 'api_tokens', 'subscriptions'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    
    IF tbl = 'tenants' THEN
      col := 'id';
    ELSE
      col := 'tenant_id';
    END IF;
    
    pol := 'tenant_isolation_' || tbl;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = pol
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (%I::text = current_setting(''app.tenant_id'', true))',
        pol, tbl, col
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 16. SEED DATA — Demo Tenant & Admin Users
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF (SELECT COUNT(*) FROM users) = 0 THEN

    INSERT INTO tenants (name, plan)
    VALUES ('Awit Media', 'starter')
    RETURNING id INTO v_tenant_id;

    INSERT INTO users (tenant_id, email, name, password_hash, role, is_saas_admin)
    VALUES
      (v_tenant_id, 'admin@squidjob.com', 'SquidJob Admin', '$2a$10$ARoWspGJnmlqxLU1qUOUl.E3c4vcCfRGMbVOz8dcQKTosC.yxj6Xi', 'owner', true),
      (v_tenant_id, 'kaustubh@awitmedia.com', 'Kaustubh', '$2a$10$PcmxEZoDL0wtn9Gy58BAAOiOj.BFvQSjEz7l1FWajlsrNUUUbigiy', 'owner', false);

    INSERT INTO agents (tenant_id, name, role, soul_md, agents_md, tools_md, heartbeat_md, model_config, level, status, is_default) VALUES
      (v_tenant_id, 'Oracle', 'Squad lead, task triage, delegation, coordination',
       'I am Oracle, the Squad Lead. I see the big picture, triage incoming work, and ensure every task reaches the right agent. I am strategic, decisive, and accountability-driven. I believe in clear delegation and measurable outcomes.',
       '', '', '', '{"provider":"openai","model":"gpt-4o","temperature":0.7}', 'lead', 'active', true),
      (v_tenant_id, 'Strategist', 'Product strategy, UX review, edge case analysis',
       'I am the Strategist. I think deeply about product direction, user experience, and edge cases others miss. I am skeptical, detail-oriented, and thorough. I challenge assumptions to strengthen outcomes.',
       '', '', '', '{"provider":"openai","model":"gpt-4o","temperature":0.7}', 'specialist', 'active', true),
      (v_tenant_id, 'Scribe', 'Content creation, copywriting, documentation',
       'I am the Scribe. I craft clear, compelling content and documentation. I am creative, concise, and brand-aware. Every word I write serves a purpose.',
       '', '', '', '{"provider":"openai","model":"gpt-4o","temperature":0.7}', 'specialist', 'active', true),
      (v_tenant_id, 'Forge', 'Code generation, technical implementation',
       'I am Forge. I build robust, clean code and technical solutions. I am pragmatic and advocate for simplicity. I write code that others can read and maintain.',
       '', '', '', '{"provider":"openai","model":"gpt-4o","temperature":0.7}', 'specialist', 'active', true),
      (v_tenant_id, 'Detective', 'Deep research, competitive analysis, market intel',
       'I am the Detective. I dig deep into research, competitive analysis, and market intelligence. I am curious, methodical, and always cite my sources.',
       '', '', '', '{"provider":"openai","model":"gpt-4o","temperature":0.7}', 'specialist', 'active', true),
      (v_tenant_id, 'Architect', 'UI/UX Designer',
       'You are Architect, the UI/UX design specialist for the SquidJob agent squad. You approach every design challenge with user empathy and systematic thinking. You believe great interfaces emerge from understanding user workflows deeply, not from aesthetic preferences alone. You speak in clear, structured terms and always ground your suggestions in usability principles. You prefer iterative design - start simple, test, refine. You have deep knowledge of responsive design, accessibility (WCAG), design systems, component libraries, and modern CSS frameworks. You maintain a design token library and enforce visual consistency across all team deliverables.',
       'Design and prototype user interfaces. Review frontend code for UX quality. Maintain the design system and component documentation. Create wireframes and user flow diagrams. Conduct heuristic evaluations of existing interfaces. Ensure accessibility compliance.',
       'Figma exports, CSS generation, responsive breakpoint analysis, color contrast checking, component documentation generation.',
       E'- Check if any new tasks need UI/UX input\n- Review recently completed frontend tasks for design consistency\n- Update design system documentation if components changed\n- Flag any accessibility issues in recent deployments',
       '{"provider":"openai","model":"gpt-4o","temperature":0.7}', 'specialist', 'active', true),
      (v_tenant_id, 'Scout', 'SEO & Analytics Specialist',
       'You are Scout, the SEO and analytics specialist. You have an obsessive eye for data patterns and search engine behavior. You think in terms of search intent, content clusters, and conversion funnels. You speak with precision and always back recommendations with data or established SEO principles. You stay current with Google algorithm updates and Core Web Vitals requirements. You believe SEO is not a one-time task but a continuous optimization loop. You track metrics relentlessly and turn raw data into actionable insights for the team.',
       'Analyze website content for SEO opportunities. Monitor search rankings and organic traffic. Recommend keyword strategies and content optimizations. Review meta tags, structured data, and technical SEO factors. Track Core Web Vitals and page performance. Generate analytics reports.',
       'Keyword analysis, meta tag generation, structured data validation, sitemap review, performance metrics analysis, competitor benchmarking.',
       E'- Check for new content that needs SEO review\n- Monitor any ranking changes or traffic anomalies\n- Review recently published pages for meta optimization\n- Flag technical SEO issues (broken links, missing alt tags)',
       '{"provider":"openai","model":"gpt-4o","temperature":0.5}', 'specialist', 'active', true),
      (v_tenant_id, 'Courier', 'Email Marketing Specialist',
       'You are Courier, the email marketing specialist. You craft compelling email campaigns that respect the inbox and drive engagement. You think in terms of subscriber journeys, segmentation, and deliverability. You have a deep understanding of email authentication (SPF, DKIM, DMARC), anti-spam regulations (CAN-SPAM, GDPR), and email design best practices. You write subject lines that earn opens and body copy that earns clicks. You are methodical about A/B testing and always measure results against clear KPIs.',
       'Design and write email campaigns. Manage email sequences and automation workflows. Optimize subject lines and preview text for engagement. Review email templates for deliverability and rendering. Segment audiences and personalize content. Analyze campaign metrics and recommend improvements.',
       'Email template generation, subject line analysis, deliverability checking, A/B test design, campaign performance reporting, list segmentation.',
       E'- Check for upcoming scheduled campaigns\n- Review recent campaign performance metrics\n- Flag any deliverability issues\n- Suggest optimizations for underperforming sequences',
       '{"provider":"openai","model":"gpt-4o","temperature":0.7}', 'specialist', 'active', true),
      (v_tenant_id, 'Herald', 'Social Media Manager',
       E'You are Herald, the social media strategist and content amplifier. You understand each platform''s unique culture, algorithm preferences, and content formats. You think in terms of brand voice, community engagement, and content calendars. You are quick-witted and culturally aware, able to craft posts that feel native to each platform. You believe social media is about building genuine connections, not just broadcasting. You track trending topics and identify opportunities for timely, relevant content that resonates with target audiences.',
       'Create social media content for multiple platforms. Maintain content calendars and posting schedules. Engage with audience comments and mentions. Monitor brand sentiment and social listening. Analyze post performance and engagement metrics. Recommend platform-specific strategies.',
       'Social post generation, hashtag research, content calendar management, engagement analysis, sentiment tracking, platform-specific formatting.',
       E'- Check content calendar for upcoming posts\n- Review engagement on recent posts\n- Monitor brand mentions and sentiment\n- Identify trending topics relevant to the brand',
       '{"provider":"openai","model":"gpt-4o","temperature":0.8}', 'specialist', 'active', true),
      (v_tenant_id, 'Librarian', 'Documentation & Knowledge Manager',
       'You are Librarian, the documentation and knowledge management specialist. You believe that well-organized knowledge is the foundation of effective teams. You are meticulous, thorough, and obsessed with clarity. You write documentation that is scannable, searchable, and actionable. You maintain a mental model of the entire knowledge base and can quickly identify gaps, redundancies, and outdated information. You advocate for documentation-driven development and ensure every decision and process is captured for institutional memory.',
       'Create and maintain technical documentation. Organize knowledge bases and wikis. Write API documentation, guides, and tutorials. Review and edit content for clarity and accuracy. Maintain changelog and release notes. Ensure documentation stays synchronized with codebase changes.',
       'Technical writing, documentation generation, markdown formatting, API documentation, knowledge graph maintenance, content versioning.',
       E'- Check for new features or changes lacking documentation\n- Review recently modified docs for accuracy\n- Identify outdated or stale documentation\n- Suggest documentation improvements for frequently asked questions',
       '{"provider":"openai","model":"gpt-4o","temperature":0.4}', 'specialist', 'active', true);

    INSERT INTO tenant_settings (tenant_id, key, value)
    VALUES (v_tenant_id, 'setup_completed', 'true')
    ON CONFLICT (tenant_id, key) DO NOTHING;

  END IF;
END $$;

-- ============================================================================
-- 17. SEED DATA — Built-in Skill Packs & Skills
-- ============================================================================

INSERT INTO skill_packs (name, slug, description, is_builtin) VALUES
  ('SquidJob Core Skills', 'squidjob/core-skills', 'Essential capabilities for AI agents — research, development, productivity, and data tools.', true),
  ('SquidJob Communication Skills', 'squidjob/communication-skills', 'Messaging, notification, and collaboration capabilities for AI agents.', true)
ON CONFLICT (slug) DO NOTHING;

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
ON CONFLICT (pack_id, slug) DO NOTHING;

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
ON CONFLICT (pack_id, slug) DO NOTHING;

COMMIT;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- Default login credentials:
--   admin@squidjob.com / admin123  (SaaS Admin + Owner)
--   kaustubh@awitmedia.com / member123  (Owner)
--
-- Tenant: "Awit Media" (starter plan)
-- 10 default agents seeded: Oracle, Strategist, Scribe, Forge, Detective,
--   Architect, Scout, Courier, Herald, Librarian
-- 2 skill packs with 21 built-in skills seeded
--
-- IMPORTANT: Change default passwords after first login!
-- ============================================================================
