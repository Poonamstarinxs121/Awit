# SquidJob.com: Development architecture (Node.js + PostgreSQL)

**Awit Media Private Limited** · **SquidJob.com**

This document defines the **development architecture** for building the SquidJob.com application using **Node.js** and **PostgreSQL** as the primary stack. It translates the product specification in [Awit Architecture Draft.md](Awit%20Architecture%20Draft.md) into a concrete, implementable blueprint. The draft is Convex-centric; here PostgreSQL is the primary data store and Node.js the runtime.

---

## 1. Stack overview

| Layer | Technology | Notes |
|-------|------------|--------|
| **Runtime** | Node.js (LTS) | All API and orchestration services |
| **API** | Express or Fastify | REST + WebSocket; maps to API design in draft Section 13 |
| **Primary database** | PostgreSQL 15+ | With **pgvector** extension for memory embeddings |
| **Session cache** | Redis | Hot sessions; optional job queue backend |
| **Real-time** | PostgreSQL `LISTEN/NOTIFY` + WebSocket relay | Replaces Convex reactive subscriptions |
| **Auth** | JWT with tenant ID in claims | RBAC: Owner, Admin, Operator, Viewer |
| **BYOK** | Envelope encryption (e.g. AWS KMS + per-tenant DEK) | Keys never stored or logged in plaintext |
| **Object storage** | AWS S3 or compatible | Deliverables, cold session archives (optional) |

---

## 2. Repository and service layout

Proposed high-level structure:

```
AWIT/
├── docs/                              # All manuals and architecture (this folder)
├── services/
│   ├── api/                           # REST + WebSocket gateway (Node.js)
│   │   ├── src/
│   │   │   ├── routes/                # v1/agents, v1/tasks, v1/standups, etc.
│   │   │   ├── middleware/            # auth, tenant context, rate limit
│   │   │   ├── websocket/             # real-time relay (LISTEN/NOTIFY)
│   │   │   └── ...
│   │   └── package.json
│   ├── orchestration/                 # Agent orchestration engine (Node.js)
│   │   ├── src/
│   │   │   ├── session-manager/
│   │   │   ├── router/
│   │   │   ├── scheduler/             # cron + heartbeat (e.g. Bull/BullMQ or pg_cron)
│   │   │   └── ...
│   │   └── package.json
│   └── ...
├── packages/
│   └── db/                            # Shared DB client, migrations, types
│       ├── migrations/                # PostgreSQL DDL
│       └── src/
└── README.md
```

- **api**: HTTP server (Express/Fastify), REST routes, WebSocket endpoint, auth and tenant middleware. Reads/writes PostgreSQL and Redis; publishes events for real-time via NOTIFY or internal bus.
- **orchestration**: Session Manager, Router, Cron Scheduler; runs agent turns, calls LLM providers, enqueues cron/heartbeat jobs. Uses shared `packages/db` for schema and queries.
- **packages/db**: Migration files (e.g. `migrations/001_tenants.sql`), connection pool, optional query builder or raw SQL; used by both api and orchestration.

Exact names and depth can be adjusted; the important point is one clear split between API gateway, orchestration engine, and shared database layer.

---

## 3. PostgreSQL schema

The Convex schema in the product draft (Section 14) is translated below into **PostgreSQL DDL**. Every table includes `tenant_id` for multi-tenancy. Row Level Security (RLS) is used so that all queries are scoped by tenant; the application sets `app.tenant_id` from the JWT before running queries.

### 3.1 Core tables (DDL)

**Tenant and auth**

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector

CREATE TABLE tenants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  plan       TEXT NOT NULL CHECK (plan IN ('starter', 'professional', 'enterprise')),
  settings   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
```

**BYOK API keys**

```sql
CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  encrypted_key BYTEA NOT NULL,
  key_vault_ref TEXT,
  last_rotated  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_api_keys_tenant_provider ON api_keys(tenant_id, provider);
```

**Agents**

```sql
CREATE TABLE agents (
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
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agents_tenant ON agents(tenant_id);
CREATE INDEX idx_agents_tenant_status ON agents(tenant_id, status);
```

**Tasks**

```sql
CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL CHECK (status IN ('inbox', 'assigned', 'in_progress', 'review', 'done')),
  is_blocked   BOOLEAN NOT NULL DEFAULT false,
  blocker_reason TEXT,
  blocked_by   TEXT,
  blocked_at   TIMESTAMPTZ,
  blocked_until TIMESTAMPTZ,
  unblock_owner TEXT,
  priority     TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  assignees    UUID[] NOT NULL DEFAULT '{}',
  created_by   TEXT NOT NULL,
  parent_task  UUID REFERENCES tasks(id) ON DELETE SET NULL,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  due_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_tasks_tenant_assignees ON tasks(tenant_id) WHERE array_length(assignees, 1) > 0;
```

**Comments**

```sql
CREATE TABLE comments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id            UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id          TEXT NOT NULL,
  content            TEXT NOT NULL,
  mentions           TEXT[] NOT NULL DEFAULT '{}',
  parent_comment_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_tenant_task ON comments(tenant_id, task_id);
```

**Activity feed**

```sql
CREATE TABLE activities (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id   TEXT NOT NULL,
  action     TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id  TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_tenant_time ON activities(tenant_id, created_at DESC);
```

**Sessions**

```sql
CREATE TABLE sessions (
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
CREATE UNIQUE INDEX idx_sessions_session_key ON sessions(session_key);
CREATE INDEX idx_sessions_tenant_agent ON sessions(tenant_id, agent_id);
CREATE INDEX idx_sessions_last_active ON sessions(tenant_id, last_active_at DESC);
```

**Memory entries (with pgvector)**

```sql
CREATE TABLE memory_entries (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('long_term', 'working', 'daily_note')),
  content    TEXT NOT NULL,
  embedding  vector(768),
  date       DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_memory_entries_agent_type ON memory_entries(tenant_id, agent_id, memory_type);
CREATE INDEX idx_memory_entries_embedding ON memory_entries
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
  WHERE embedding IS NOT NULL;
```

**Deliverables**

```sql
CREATE TABLE deliverables (
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
CREATE INDEX idx_deliverables_tenant_task ON deliverables(tenant_id, task_id);
```

**Cron jobs**

```sql
CREATE TABLE cron_jobs (
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
  next_run_at     TIMESTAMPTZ NOT NULL,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cron_jobs_tenant ON cron_jobs(tenant_id);
CREATE INDEX idx_cron_jobs_next_run ON cron_jobs(is_active, next_run_at) WHERE is_active = true;
```

**Usage, notifications, standups**

```sql
CREATE TABLE usage_records (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  tokens_in      INTEGER NOT NULL DEFAULT 0,
  tokens_out     INTEGER NOT NULL DEFAULT 0,
  api_calls      INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12, 6) NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_usage_records_tenant_agent_date ON usage_records(tenant_id, agent_id, date);

CREATE TABLE notifications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_id     TEXT NOT NULL,
  recipient_type   TEXT NOT NULL CHECK (recipient_type IN ('agent', 'user')),
  type             TEXT NOT NULL CHECK (type IN ('mention', 'assignment', 'review_request', 'status_change', 'standup')),
  source_task_id   UUID REFERENCES tasks(id) ON DELETE SET NULL,
  source_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
  message          TEXT NOT NULL,
  is_read          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON notifications(tenant_id, recipient_id, is_read);

CREATE TABLE standups (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date                 DATE NOT NULL,
  summary              TEXT NOT NULL,
  per_agent_summaries  JSONB NOT NULL DEFAULT '[]',
  delivered_to         TEXT[] NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_standups_tenant_date ON standups(tenant_id, date);
```

**Audit log**

```sql
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_tenant_time ON audit_log(tenant_id, created_at DESC);
```

### 3.2 Row Level Security (RLS)

Tenant context is set by the application from the JWT (e.g. `SET LOCAL app.tenant_id = '<uuid>'`) at the start of each request. RLS policies ensure rows from other tenants are never visible or writable.

```sql
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE standups ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Example policy (apply same pattern to all tenant-scoped tables):
CREATE POLICY tenant_isolation_tenants ON tenants
  USING (id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Repeat for api_keys, agents, tasks, comments, activities, sessions,
-- memory_entries, deliverables, cron_jobs, usage_records, notifications,
-- standups, audit_log: USING (tenant_id::text = current_setting('app.tenant_id', true));
```

Service accounts (e.g. orchestration worker) that need to act on behalf of a tenant must set `app.tenant_id` from the job or message context before running queries. Never trust tenant ID from user input; always from JWT or internal context.

---

## 4. Session and memory persistence

- **Hot:** Redis, keyed by session key (e.g. `tenant:{id}:agent:{id}:main`). TTL or LRU per draft (e.g. 15 minutes of inactivity). Store serialized session state (conversation buffer, token count, model config).
- **Warm:** PostgreSQL `sessions` table. When a session is evicted from Redis or after a threshold without access, persist to `sessions`; on next access, load from DB and optionally repopulate Redis.
- **Cold:** Optional: export old sessions to object storage (S3) and clear or compress in DB; on-demand rehydration into `sessions` or Redis when needed.
- **Memory:** All memory content and embeddings in PostgreSQL `memory_entries`. Hybrid retrieval: keyword (e.g. BM25-style via `tsvector`/full-text) + pgvector similarity (e.g. `<=>` or inner product). Fuse and rerank in the application layer. See product draft Section 5 for QMD-inspired pipeline (query expansion, RRF, reranking).

---

## 5. API and real-time

**REST:** The Node.js API service implements the same resource paths as in the product draft (Section 13):

- Auth: `POST /auth/token`
- Agents: `GET/POST /v1/agents`, `GET/PATCH /v1/agents/:id`, `GET /v1/agents/:id/sessions`, `POST /v1/agents/:id/message`
- Tasks: `GET/POST /v1/tasks`, `GET/PATCH /v1/tasks/:id`, `POST /v1/tasks/:id/comments`
- Standups: `GET /v1/standups`, `GET /v1/standups/latest`
- Activity: `GET /v1/activity`
- Webhooks: `POST/GET/DELETE /v1/webhooks`
- Config: `GET/POST/DELETE /v1/config/providers`

Tenant is taken from the JWT (and set in `app.tenant_id` for RLS); it must not be passed in the path or query.

**WebSocket:** Single endpoint, e.g. `GET /v1/realtime?token=<jwt>`. Clients send subscribe messages (e.g. `{ "type": "subscribe", "channel": "tasks", "filters": { "status": "in_progress" } }`). The server subscribes to PostgreSQL `LISTEN` on tenant-scoped channels (e.g. `tenant:<id>:tasks`). When the API or orchestration layer performs a write that should notify the client, it runs `NOTIFY tenant:<id>:tasks, '<payload>'`. A small relay in the API service receives NOTIFY and pushes to the appropriate WebSocket clients. This replaces Convex reactive subscriptions.

### Telegram integration (MVP)

Telegram is the first supported chat-channel integration, scoped to notifications + safe quick commands.

- **Inbound:** `POST /v1/integrations/telegram/webhook` receives Telegram bot updates (messages, commands). The API validates bot secret, resolves tenant + user mapping, then executes the corresponding Mission Control action (create task, list tasks, update status, assign agent, request standup).
- **Outbound:** a delivery worker reads queued messages (e.g. from `notifications` or a dedicated outbound queue table) and sends them to the mapped `telegramChatId` with retry + backoff.
- **Notifications covered:** @mentions, assignments, review requests, and daily standup summary.

---

## 6. Scheduling (cron and heartbeats)

- **Storage:** Cron and heartbeat definitions live in PostgreSQL `cron_jobs` (and tenant settings for heartbeat interval), as in the draft.
- **Execution:** Use a Node.js worker (in the orchestration service) with a job queue (e.g. Bull/BullMQ backed by Redis). A single cron-like loop (or a scheduled job every minute) queries `cron_jobs` for rows where `is_active = true` and `next_run_at <= now()`, enqueues a job per row, and updates `next_run_at` and `last_run_at`. Alternatively, use `pg_cron` to call an internal HTTP endpoint that performs the same enqueue. Heartbeats are either special cron jobs or a separate loop that enqueues heartbeat jobs per agent based on tenant heartbeat interval and stagger.
- **Distributed lock:** Use Redis SETNX (or Redlock) so only one instance of the scheduler processes “due cron jobs” at a time, preventing duplicate execution across multiple Node instances.

---

## 7. Security and BYOK

- **Tenant context:** Set once at API gateway from JWT; pass via headers or request context through all services; use for RLS and audit. Never trust tenant from request body or path.
- **API keys (BYOK):** Stored encrypted in `api_keys.encrypted_key`. Use envelope encryption: per-tenant DEK encrypts the customer API key; KEK (e.g. AWS KMS) wraps the DEK. Decrypt only in memory when calling LLM providers; never log or persist plaintext. See product draft Section 9.
- **Audit:** Append-only `audit_log` table. On every sensitive action (API key access, task change, config change, etc.), insert a row (tenant_id, actor_id, action, target_type, target_id, metadata, created_at). No updates or deletes.

**Telegram security considerations (must-have):** validate bot tokens/secrets; scope every update to tenant; prevent cross-tenant chat leakage; restrict commands by user role; log deliveries and failures for support/audit.

---

## 8. Frontend and Mission Control

- **Stack:** React + Vite + Tailwind as in the draft. No Convex; the UI talks only to the Node.js API.
- **Data:** REST for all mutations and initial loads. WebSocket for real-time updates (tasks, activity feed, agent status). Mission Control subscribes to channels (e.g. `tasks`, `activity`) and updates the Kanban and feed when events arrive.
- **Auth:** Same JWT and tenant model. Optional: Auth0 or Clerk for login UI; issue JWTs that include tenant and role for the API.

---

## 9. Deployment and scaling

- **API and orchestration:** Run as stateless Node.js processes behind a load balancer. Scale horizontally; session state lives in Redis and PostgreSQL, not in process.
- **PostgreSQL:** Single primary for MVP. Add read replicas for dashboard and read-heavy queries when needed; use the primary for all writes and for NOTIFY.
- **Redis:** Session store and optional job queue; single instance or cluster per environment.
- **Tenant scaling:** Shared schema + RLS for many small tenants. Later, schema-per-tenant or dedicated instances for large tenants (graduated isolation) as in the product draft; tenant routing at the API gateway can direct to the correct DB or schema.

---

## References

- [Awit Architecture Draft.md](Awit%20Architecture%20Draft.md) — Product specification, API design (Section 13), Convex schema (Section 14), tech stack and scaling (Sections 16–18).
