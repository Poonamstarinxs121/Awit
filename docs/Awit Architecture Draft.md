# SQUIDJOB: Multi-agent AI orchestration platform — scope and architecture

**SQUIDJOB is a multi-tenant SaaS platform that turns independent AI agents into coordinated teams, providing the orchestration layer, Mission Control UI, shared database, and agent management while customers bring their own API keys and compute.** This document serves as the authoritative product specification and technical blueprint. It draws on the OpenClaw framework (175K+ GitHub stars), Bhanu Teja P's Mission Control implementation, QMD's hybrid search architecture, and established multi-tenant SaaS patterns to define a system capable of managing isolated agent squads at scale. The architecture supports a full 10-agent deployment from day one, customer-created sub-agents, real-time inter-agent communication, and a phased delivery roadmap from MVP to enterprise scale.

---

## Product philosophy (the agenda)

- The tech matters, but it isn't the secret.
- The secret is to treat AI agents like **team members**.
- Give them **roles**. Give them **memory**. Let them **collaborate**. Hold them **accountable**.
- They won't replace humans. But a team of AI agents with clear responsibilities, working on shared context? That's a **force multiplier**.

---

## 1. System architecture at 30,000 feet

SQUIDJOB's architecture follows a **hub-and-spoke model** with five primary subsystems. At the center sits the Agent Orchestration Engine — the "nervous system" that coordinates all agent activity. Radiating outward: the BYOK Gateway (authenticating and routing customer API keys to LLM providers), the Session & Memory Layer (managing agent state, context, and persistence), the Mission Control UI (the human-facing command surface), and the Multi-Tenant Infrastructure (isolating customer data and compute).

```
┌─────────────────────────────────────────────────────────────────┐
│                      MISSION CONTROL UI                         │
│        (Kanban · Activity Feed · Agent Roster · Standups)       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ WebSocket / REST
┌──────────────────────────────▼──────────────────────────────────┐
│                      API GATEWAY / WAF                           │
│            (Auth · Rate Limiting · Tenant Routing)               │
└──────────────────────────────┬──────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│  BYOK GATEWAY    │ │ AGENT ORCH.      │ │ SESSION & MEMORY     │
│  (Key Vault ·    │ │ ENGINE           │ │ LAYER                │
│   Model Router · │ │ (Scheduler ·     │ │ (Context Mgmt ·      │
│   Usage Tracker) │ │  Router ·        │ │  Compression ·       │
│                  │ │  Task Manager)   │ │  Persistence)        │
└────────┬─────────┘ └────────┬─────────┘ └──────────┬───────────┘
         │                    │                       │
         ▼                    ▼                       ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│  LLM PROVIDERS   │ │ SHARED DATABASE  │ │ OBJECT STORAGE       │
│  (OpenAI ·       │ │ (Convex/Postgres │ │ (Deliverables ·      │
│   Anthropic ·    │ │  Real-time Sync) │ │  Memory Files ·      │
│   Google · etc.) │ │                  │ │  Session Logs)       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

Every request entering the system passes through tenant identification, authentication, and rate limiting before reaching the orchestration layer. **Tenant context is injected at the API gateway and propagated through every downstream service**, ensuring complete isolation from the first byte to the last.

---

## 2. Multi-tenant infrastructure: isolation without overhead

SQUIDJOB adopts a **hybrid isolation model** that balances cost efficiency with security guarantees across three customer tiers. The fundamental design principle: shared control plane, isolated data plane.

**Starter tier** uses a shared-schema database with row-level security enforced by `tenant_id` on every table. All agents run in shared compute pools with resource quotas. This minimizes infrastructure cost per customer and supports rapid onboarding.

**Professional tier** elevates to schema-per-tenant in the primary database, dedicated vector store namespaces, and gVisor-sandboxed compute containers. Agent sessions receive guaranteed compute allocation, preventing noisy-neighbor degradation.

**Enterprise tier** provisions a dedicated database instance per customer, Firecracker microVM-based agent sandboxing with hardware-enforced isolation, customer-managed encryption keys (BYOK encryption), and optional VPC peering. Compliance with SOC 2, HIPAA, and GDPR becomes achievable at this level.

The tenant isolation matrix spans six resource categories:

| Resource | Starter | Professional | Enterprise |
|----------|---------|-------------|-----------|
| Database | Shared schema + RLS | Schema per tenant | Dedicated instance |
| Compute | Shared pool + quotas | gVisor containers | Firecracker microVMs |
| File storage | Shared bucket, prefixed paths | Dedicated namespace | Dedicated bucket |
| Vector store | Shared index, filtered | Namespace-isolated | Dedicated cluster |
| API keys | Encrypted in shared vault | Vault per tenant | Customer-managed vault |
| Network | Shared + rate limits | Dedicated rate limits | VPC peering available |

The **tenant context propagation chain** works as follows: API Gateway extracts tenant ID from JWT → injects into request headers → every downstream service reads tenant ID from headers (never from user input) → database queries are scoped by compound indexes on `tenant_id` → audit logs capture tenant ID for every operation. This "inject once, verify everywhere" pattern prevents cross-tenant data leakage.

---

## 3. The agent orchestration engine

The orchestration engine is SQUIDJOB's core differentiator — the daemon process that transforms individual AI agents into coordinated squads. Its design draws directly from OpenClaw's Gateway daemon architecture, adapted for multi-tenant cloud execution.

### Three core components

**The Session Manager** maintains all active agent sessions across every tenant. Each session is identified by a composite key: `tenant:<tenantId>:agent:<agentId>:context:<contextType>`. Session state includes the current conversation history, active tools, model configuration, and memory references. The Session Manager handles session creation, compaction (when context approaches token limits), and graceful termination. Before compaction, it triggers a **memory flush** — a silent agentic turn where the agent writes durable insights to long-term memory before older context is summarized and discarded.

**The Router** handles inbound message dispatch. When a task arrives (from the UI, an API call, or another agent), the Router resolves the target agent based on task type, agent capabilities, current load, and tenant-specific routing rules. Multi-agent routing uses a most-specific-match algorithm: explicit agent assignments override capability-based routing, which overrides round-robin distribution. The Router also manages inter-agent message passing for collaborative tasks.

**The Cron Scheduler** manages all time-based agent activity. Jobs are persisted in the database (not filesystem) for cloud reliability. It supports three scheduling modes: cron expressions with IANA timezone support for recurring tasks, one-shot `at` scheduling for deferred work, and interval-based heartbeats for proactive monitoring. Each cron job specifies its execution mode — **main-session** (runs within the agent's persistent context) or **isolated** (fresh session per run, preventing history pollution). The Scheduler implements exponential retry backoff (30s → 1m → 5m → 15m → 60m) for failed jobs.

### Agent execution lifecycle

Every agent turn follows a deterministic loop: **receive input → load context (SOUL + memory + task state) → invoke LLM with customer's API key → execute tool calls in sandbox → persist results → route output**. The orchestration engine ensures this loop executes within the customer's resource quotas and API rate limits. Tool calls are sandboxed using gVisor or Firecracker depending on the tenant's isolation tier, with network egress restricted to whitelisted endpoints.

---

## 4. Session management and persistence

Sessions are the fundamental unit of agent state. SQUIDJOB's session architecture must handle the unique challenge of **cloud-persistent, multi-tenant agent sessions** — unlike OpenClaw's single-user filesystem approach.

### Session key structure

```
tenant:{tenantId}:agent:{agentId}:main          — Primary workspace session
tenant:{tenantId}:agent:{agentId}:task:{taskId}  — Task-scoped session
tenant:{tenantId}:agent:{agentId}:cron:{jobId}   — Isolated cron session
tenant:{tenantId}:agent:{agentId}:collab:{threadId} — Collaboration session
```

### Session state model

Each session maintains: a **conversation buffer** (recent messages in token-limited sliding window), a **compaction summary** (LLM-generated summary of older conversation), **active tool state** (in-progress tool calls and results), **model configuration** (which LLM, temperature, max tokens), and **memory references** (pointers to SOUL, MEMORY, and WORKING files).

**Session persistence** uses a tiered storage strategy. Hot sessions (active within the last 15 minutes) live in Redis with sub-millisecond access. Warm sessions (active within the last 24 hours) are stored in the primary database. Cold sessions (older than 24 hours) are compressed and archived to object storage (S3/GCS) with on-demand rehydration. Session transcripts are saved with LLM-generated descriptive slugs for searchability.

### Auto-compaction protocol

When a session's token count reaches **80% of the model's context window**, SQUIDJOB triggers automatic compaction:

1. **Memory flush**: Silent agentic turn extracts durable facts, decisions, and user preferences → writes to WORKING.md and daily notes
2. **Summarization**: Older conversation rounds are summarized by a lightweight model (to save cost on the customer's API key)
3. **Context rebuild**: New context = SOUL.md + MEMORY.md + WORKING.md + compaction summary + recent messages
4. **Verification**: Token count confirmed within budget before resuming

This protocol preserves **critical context across compactions** while keeping token usage bounded — a direct adaptation of OpenClaw's pre-compaction memory flush pattern.

---

## 5. Memory and context management with QMD-inspired compression

Memory management is where SQUIDJOB can achieve its most significant cost optimization. The system implements a **four-tier memory stack** inspired by OpenClaw's file-first approach, enhanced with cloud-native compression techniques drawn from QMD's hybrid search architecture.

### The memory stack

**Tier 1 — SOUL files (identity layer, loaded every session)**. Each agent has a SOUL.md defining its personality, behavioral philosophy, and identity. This is not instructions — it is who the agent *is*. SOUL.md follows three sections: Core Truths, Boundaries, and The Vibe. Additionally, AGENTS.md provides operating instructions, and TOOLS.md defines capabilities. These files are small (typically **200-500 tokens**), loaded at every session start, and rarely change. They are stored as tenant-scoped objects in the database.

**Tier 2 — Long-term memory (MEMORY.md, curated facts)**. Durable knowledge the agent has accumulated: user preferences, project decisions, learned patterns, factual context. Updated infrequently, loaded selectively based on relevance. MEMORY.md is scoped per-agent and per-tenant, stored in the database with vector embeddings for semantic retrieval.

**Tier 3 — Working memory (WORKING.md, active session state)**. The agent's "desk" — current task context, in-progress reasoning, temporary notes. Updated frequently during active work. Persists across compactions within a session but is cleared between tasks. This corresponds to OpenClaw's SESSION-STATE.md community pattern.

**Tier 4 — Daily notes (ephemeral, append-only)**. Running log of the day's activities, observations, and micro-decisions. Append-only during the day, summarized and compressed into MEMORY.md during nightly maintenance. Stored as time-series entries in the database.

### QMD-inspired context compression

QMD — Tobi Lütke's local hybrid search engine for markdown files — is **not** a compression tool in the traditional sense. It is a retrieval system that uses BM25 keyword search, vector semantic search, and LLM reranking to find and deliver only the most relevant document chunks. Its approach to "context optimization" is fundamentally about **intelligent retrieval rather than lossy compression**.

For SQUIDJOB, the QMD architecture provides a powerful reference model for memory retrieval:

**Hybrid search pipeline for memory access.** Rather than loading entire MEMORY.md files into context (potentially thousands of tokens), SQUIDJOB implements QMD's four-stage retrieval pipeline adapted for cloud execution:

1. **Query expansion**: The current task/message is expanded into 2-3 query variants using a lightweight model
2. **Parallel retrieval**: All queries run against both BM25 (keyword) and vector (semantic) indexes over the agent's memory files
3. **Reciprocal Rank Fusion (RRF)**: Results from all retrieval paths are fused using position-aware blending
4. **Reranking**: A cross-encoder model scores and reranks the fused results for optimal relevance

This approach means an agent with 50,000 tokens of accumulated MEMORY.md content might inject only **800-1,200 tokens** of the most relevant memories into its context window — a **95%+ reduction** in memory-related token consumption.

**Key architectural differences from QMD for cloud deployment:**

| Aspect | QMD (Local) | SQUIDJOB (Cloud SaaS) |
|--------|-------------|----------------------|
| Runtime | Bun + SQLite | Node.js + PostgreSQL/pgvector |
| Embeddings | Local GGUF model (300MB) | Cloud embedding API (tenant's key or shared) |
| Reranking | Local GGUF cross-encoder | Cloud reranker or lightweight hosted model |
| Storage | Single-user SQLite | Multi-tenant PostgreSQL with RLS |
| Indexing | File watcher with debounce | Event-driven reindex on memory writes |
| Concurrency | Single-user, no locks | Multi-tenant, row-level locking |

**Additional compression strategies layered on top:**

- **Session history summarization**: Sliding window keeps last 5 messages verbatim; older messages are recursively summarized using Memory-Block Protocol (segment into blocks of ~N turns, compress each block to ≤120 tokens)
- **Relevance filtering**: Before injecting any context, a lightweight classifier scores each context source against the current task. Sources below a relevance threshold are excluded entirely. This alone achieves **50-70% token reduction**.
- **Structured prompting**: Agent instructions use compact JSON/YAML structures rather than prose where possible, yielding **20-30% savings** on instruction tokens
- **Semantic deduplication**: When multiple memory entries convey overlapping information, they are merged into a single canonical entry during nightly maintenance
- **Prompt caching**: Anthropic and other providers support prompt caching for repeated prefixes; SOUL.md and system instructions benefit directly from this, as they remain identical across turns

### Context budget allocation

Each agent turn operates within a **token budget** distributed across sources using priority weights:

| Source | Priority | Min Tokens | Max Tokens | Typical |
|--------|----------|-----------|-----------|---------|
| System prompt + SOUL.md | Critical | 300 | 800 | 500 |
| Task context | High | 500 | 4,000 | 2,000 |
| Retrieved memories | Medium | 200 | 2,000 | 800 |
| Session history | Medium | 500 | 4,000 | 2,000 |
| Tool results | Variable | 0 | 8,000 | 1,000 |
| Working memory | Low | 100 | 1,000 | 400 |
| **Total typical** | | | | **~6,700** |

The Token Budget Allocator dynamically adjusts these allocations based on model context window size (varies by provider/model), current task complexity, and available relevant content. This ensures **maximum information density per token spent**.

---

## 6. Communication layer: notifications, @mentions, and threads

Real-time communication is the connective tissue that transforms independent agents into a functioning squad. SQUIDJOB implements three communication primitives.

**@Mentions** are the primary notification mechanism. When an agent or human includes `@agent-name` in a comment or message, the system triggers a targeted notification. The mentioned agent receives a system event in its next heartbeat cycle (or immediately if configured for real-time). @Mentions create explicit accountability — the mentioned agent is expected to respond. Implementation: regex parsing of message content → resolve agent references against tenant's agent roster → create notification records → push via WebSocket to Mission Control UI → queue for agent's next active turn.

**Thread subscriptions** enable agents to follow conversations relevant to their work without being explicitly mentioned. When an agent comments on a task, it automatically subscribes to that task's comment thread. New comments trigger notifications to all subscribers. Agents can manually subscribe to or unsubscribe from any thread. This creates organic awareness without notification overload.

**The activity feed** provides a real-time, filterable stream of all squad activity: task status changes, comments, agent actions, deliverable uploads, standup summaries. Powered by Convex's reactive subscriptions (or PostgreSQL LISTEN/NOTIFY with a WebSocket relay), the feed updates in real-time without polling. Filters allow viewing by agent, task, time range, or activity type.

### Inter-agent direct messaging

For collaboration that doesn't fit the task-comment model, agents can send direct messages to other agents' sessions. This uses a request-response pattern: Agent A sends a message to Agent B's session key → Agent B processes on next turn → response routed back to Agent A. Optional **reply-back ping-pong** enables multi-turn agent conversations, with a configurable maximum depth to prevent infinite loops.

---

## 7. Mission Control UI and UX

Mission Control is the human command surface for SQUIDJOB — the interface where customers observe, direct, and manage their agent squads. Its design follows the Kanban-centric pattern proven by Bhanu Teja P's implementation, extended for multi-tenant SaaS.

### Core views

**The Dashboard** provides a real-time overview: agent roster with status indicators (active/idle/error), task pipeline summary (counts per status column), today's activity metrics (tasks completed, tokens consumed, cost), and the live activity feed. This is the "at a glance" view that answers "what is my squad doing right now?"

**The Kanban Board** visualizes the task lifecycle across five columns: Inbox → Assigned → In Progress → Review → Done. Cards show task title, assigned agent(s), priority, due date, and a progress indicator. Cards can also display a **Blocked** badge (a flag, not a separate workflow stage) with a short blocker summary. Drag-and-drop enables manual task reassignment. Clicking a card opens the Task Detail Panel with full description, comment thread, deliverables, and activity history.

**The Agent Roster** displays all active agents with their SOUL personality summaries, current task assignments, capability tags, and health status. Each agent card links to the agent's configuration page where customers can view and edit SOUL.md, review memory contents, adjust model settings, and view session transcripts.

**The Standup View** presents the daily standup summary in a structured format: per-agent completed work, in-progress items, blockers, and priorities. Historical standups are archived and searchable.

### Technical implementation

The UI is built as a React SPA (using Vite for builds) with Convex providing real-time data subscriptions. Every query in Convex is reactive — when an agent updates a task status in the database, the Kanban board re-renders automatically without polling or manual refresh. Authentication uses Convex Auth with tenant-scoped access controls. The UI connects to the SQUIDJOB API layer via REST for mutations and WebSocket for real-time subscriptions.

---

## 8. Task management system

Tasks are the unit of work in SQUIDJOB. The task lifecycle follows a five-stage pipeline directly adapted from the Mission Control pattern.

### Task lifecycle

**Inbox**: Tasks enter the system via human creation in Mission Control, agent self-creation (agents can autonomously identify work), API submission, or daily standup blockers. New tasks have no assignee and await triage.

**Assigned**: A task is claimed by an agent (autonomous) or assigned by a human. The assigned agent receives a notification and the task appears in its active work queue. Multiple agents can be assigned to a single task for collaborative work.

**In Progress**: The agent is actively working on the task. Status updates, partial deliverables, and working notes are posted as comments. Other agents can observe progress via thread subscriptions.

**Review**: The agent marks work as ready for review. Depending on configuration, review can be performed by another agent (peer review), a human operator, or an automated quality gate. Reviewers can approve (→ Done), request changes (→ In Progress), or reject (→ Inbox for reassignment).

**Done**: Task is complete. Deliverables are stored, final notes archived, and the task is removed from active boards (but remains searchable in history).

**Blocked (flag, not a stage)**: Tasks can be marked **Blocked** at any point in the workflow without moving columns. A blocked task carries a blocker reason and ownership metadata, and appears prominently in the Kanban UI (badge + filters), Standups (blockers section), and the Activity Feed.

### Task data model

```
tasks {
  id:           string (UUID)
  tenant_id:    string (FK → tenants)
  title:        string
  description:  text
  status:       enum (inbox | assigned | in_progress | review | done)
  is_blocked:   boolean
  blocker_reason: string?
  blocked_by:   string?
  blocked_at:   timestamp?
  blocked_until: timestamp?
  unblock_owner: string?
  priority:     enum (critical | high | medium | low)
  assignees:    array<agent_id>
  created_by:   string (agent_id or user_id)
  parent_task:  string? (FK → tasks, for subtasks)
  deliverables: array<file_reference>
  due_date:     timestamp?
  tags:         array<string>
  created_at:   timestamp
  updated_at:   timestamp
}

task_comments {
  id:           string (UUID)
  tenant_id:    string (FK → tenants)
  task_id:      string (FK → tasks)
  author_id:    string (agent_id or user_id)
  content:      text
  mentions:     array<agent_id>
  thread_id:    string? (for nested replies)
  created_at:   timestamp
}

task_activity {
  id:           string (UUID)
  tenant_id:    string (FK → tenants)
  task_id:      string (FK → tasks)
  actor_id:     string
  action:       enum (created | assigned | status_changed | commented | ...)
  metadata:     jsonb
  created_at:   timestamp
}
```

---

## 9. Security and isolation: defense in depth

Security in a multi-tenant AI agent platform requires layered controls across six domains. Every layer assumes the others might fail.

### API key management (BYOK)

Customer API keys for LLM providers are the most sensitive data SQUIDJOB handles. The platform **never** logs, displays, or exposes plaintext keys after initial submission. Keys are encrypted using envelope encryption: a per-tenant Data Encryption Key (DEK) wraps the API key, and a master Key Encryption Key (KEK) in AWS KMS (or equivalent) wraps the DEK. Decryption occurs only in-memory during API call execution, with **zero persistence of plaintext keys** to disk or logs.

For enterprise customers, SQUIDJOB supports **customer-managed key vaults** via cross-tenant service principals — the customer stores their own keys in their own AWS Secrets Manager or Azure Key Vault, and SQUIDJOB accesses them through federated identity. This gives customers independent audit trails and instant revocation capability.

### Agent execution sandboxing

All agent tool execution runs in isolation boundaries appropriate to the tenant's tier:

- **Starter**: Hardened Docker containers with seccomp profiles, read-only filesystems, dropped capabilities, and network egress restricted to whitelisted LLM provider endpoints
- **Professional**: gVisor (runsc) containers providing syscall-level interception — a user-space kernel that intercepts all system calls, preventing container escape
- **Enterprise**: Firecracker microVMs with dedicated kernels, **125ms boot time**, hardware-enforced memory isolation, and dedicated network namespaces

### Access control model

SQUIDJOB implements RBAC with four roles: **Owner** (full tenant administration, billing, API key management), **Admin** (agent configuration, task management, user management), **Operator** (task creation, agent interaction, dashboard access), and **Viewer** (read-only dashboard and standup access). API access uses OAuth 2.0 with tenant-scoped JWTs. Agent-to-agent communication is authenticated via internal service tokens that cannot be used externally.

### Audit and compliance

Every action in the system is recorded in an append-only audit log: API key access events, agent tool invocations, task status changes, configuration modifications, and data access operations. Audit logs are tenant-scoped, immutable, and retained per the customer's data retention policy (minimum 90 days, configurable up to 7 years for regulated industries).

---

## 10. Heartbeat and scheduling system

The scheduling system gives agents autonomy — the ability to act without being prompted. SQUIDJOB implements the dual heartbeat/cron pattern from OpenClaw, adapted for multi-tenant cloud execution.

### Heartbeats

Each agent has a configurable heartbeat interval (default: **15 minutes**, matching the reference architecture's staggered intervals). During a heartbeat, the agent's session receives a system event. The agent reads its HEARTBEAT.md checklist — a tenant-configurable list of checks like "review inbox for new tasks," "check for @mentions," "update working notes." If nothing requires attention, the agent responds with `HEARTBEAT_OK`, which is silently consumed (no notification to humans, no token cost for output delivery).

**Staggered scheduling** prevents thundering herd problems: agents within a tenant are offset by `heartbeat_interval / agent_count` so they don't all fire simultaneously. This distributes API key usage evenly across the interval.

**Cost optimization**: Heartbeat turns use the cheapest model that can reliably evaluate the checklist (e.g., Claude Haiku or GPT-4o-mini). HEARTBEAT.md files are kept deliberately small (under 200 tokens) to minimize per-heartbeat token cost. An empty HEARTBEAT.md (blank or headers-only) causes the heartbeat to be **skipped entirely**, saving the API call.

### Cron jobs

Precise time-based scheduling for recurring and one-shot tasks. Cron jobs are stored in the database (not filesystem) with per-tenant isolation. Each job specifies: schedule (5-field cron expression with timezone), target agent, execution mode (main-session or isolated), delivery channel (Mission Control, email, Slack webhook), and model override. Isolated cron sessions receive a fresh context per run, preventing history accumulation from polluting the agent's main session.

---

## 11. Daily standup generation

Daily standups are a signature feature that transforms agent squads from black boxes into transparent teams. SQUIDJOB generates standups using a **cron-triggered aggregation pattern**.

At a configurable time each day (default: end of business day in the tenant's timezone), a cron job triggers the standup generation workflow:

1. **Data collection**: Query all task activity for the past 24 hours — status changes, comments, deliverable uploads, new tasks created, tasks completed
2. **Per-agent summarization**: For each active agent, compile activity into three categories: completed work, in-progress items, and blockers/risks
3. **Squad-level synthesis**: An LLM generates a cohesive standup narrative that highlights cross-agent dependencies, identifies bottlenecks, and surfaces items requiring human attention
4. **Delivery**: The standup is posted to Mission Control's Standup View and optionally delivered via email, Slack webhook, or other configured channels

The standup serves dual purposes: **accountability** (if an agent claims to have worked on something but no activity shows in the system, there's a discrepancy to investigate) and **awareness** (humans get a daily digest without needing to monitor the activity feed continuously). Historical standups are archived and searchable, creating a narrative record of the squad's progress over time.

---

## 12. Sub-agent creation and configuration

SQUIDJOB ships with a default roster of **10 pre-configured agents** inspired by Mission Control-style multi-agent squads, but adapted for general-purpose business use:

| Agent | Role | Default SOUL Archetype |
|-------|------|----------------------|
| **Oracle** | Squad Lead, task triage, delegation | Strategic thinker, sees the big picture |
| **Strategist** | Product strategy, UX review, edge cases | Skeptical, detail-oriented, thorough |
| **Detective** | Deep research, competitive analysis, market intel | Curious, methodical, citation-driven |
| **Scribe** | Content creation, copywriting, documentation | Creative, concise, brand-aware |
| **Forge** | Code generation, technical implementation | Pragmatic, clean-code advocate |
| **Architect** | UI/UX design, visual assets, prototyping | User-centric, aesthetic sensibility |
| **Scout** | Search optimization, keyword strategy | Data-driven, algorithm-aware |
| **Courier** | Email marketing, lifecycle messaging | Systematic, audience-aware, consistent |
| **Herald** | Social media, distribution, community | Hook-driven, iterative, engagement-aware |
| **Librarian** | Documentation, knowledgebase curation | Organized, precise, clarity-first |

In the Mission Control UI, **Kaustubh - Founder** is the human tenant owner label; the default squad lead agent is **Oracle (Squad Lead)**.

### Custom sub-agent creation

Beyond the default roster, customers can create unlimited custom agents through Mission Control's Agent Builder:

1. **Identity configuration**: Name, avatar, role description
2. **SOUL.md editor**: Rich text editor for crafting the agent's personality using the three-section framework (Core Truths, Boundaries, The Vibe). A built-in "SoulCraft" wizard interviews the customer and generates an optimized SOUL.md
3. **Capability assignment**: Select which tools the agent can access (web search, code execution, file management, API calls, etc.)
4. **Model selection**: Choose which LLM model the agent uses (from the customer's connected providers)
5. **Heartbeat configuration**: Set check interval, define HEARTBEAT.md checklist items
6. **Routing rules**: Define what types of tasks this agent should handle

Custom agents inherit the tenant's security posture, isolation tier, and API key configuration. They join the shared database and can communicate with all other agents in the tenant's squad.

---

## 13. API design for integrations

SQUIDJOB exposes a RESTful API for external integrations, complemented by WebSocket subscriptions for real-time data.

### Core API endpoints

```
Authentication
POST   /auth/token                    — OAuth 2.0 token exchange

Agents
GET    /v1/agents                     — List tenant's agents
POST   /v1/agents                     — Create custom agent
GET    /v1/agents/{id}                — Get agent details
PATCH  /v1/agents/{id}                — Update agent configuration
GET    /v1/agents/{id}/sessions       — List agent's sessions
POST   /v1/agents/{id}/message        — Send message to agent

Tasks
GET    /v1/tasks                      — List tasks (filtered by status, assignee, etc.)
POST   /v1/tasks                      — Create task
GET    /v1/tasks/{id}                 — Get task details with comments
PATCH  /v1/tasks/{id}                 — Update task (status, assignee, etc.)
POST   /v1/tasks/{id}/comments        — Add comment (supports @mentions)

Standups
GET    /v1/standups                   — List standup summaries
GET    /v1/standups/latest            — Get most recent standup

Activity
GET    /v1/activity                   — Activity feed (paginated, filterable)

Webhooks
POST   /v1/webhooks                   — Register webhook endpoint
GET    /v1/webhooks                   — List registered webhooks
DELETE /v1/webhooks/{id}              — Remove webhook

Integrations (Telegram)
POST   /v1/integrations/telegram/connect     — Connect bot + tenant (map tenant users to Telegram chat IDs)
POST   /v1/integrations/telegram/webhook     — Telegram webhook receiver (bot updates and commands)
GET    /v1/integrations/telegram/status      — Connection health + last delivery status
DELETE /v1/integrations/telegram/disconnect  — Disconnect Telegram for tenant

Configuration
GET    /v1/config/providers           — List connected LLM providers
POST   /v1/config/providers           — Connect API key for provider
DELETE /v1/config/providers/{id}     — Disconnect provider
```

### Telegram integration (MVP scope)

Telegram is the first chat-channel integration to complement the Mission Control web app. The MVP scope is intentionally small and safe:

- **Notifications**: @mentions, task assignments, review requests, and daily standup summary.
- **Quick commands** (safe subset): create task, list my tasks, change status, assign agent, request standup.

Delivery semantics: outbound notifications are queued in the database and delivered by a worker with retries; failures are logged for audit and support.

### WebSocket subscription protocol

```
ws://api.squidjob.com/v1/realtime?token={jwt}

Subscribe:  { "type": "subscribe", "channel": "tasks", "filters": { "status": "in_progress" } }
Subscribe:  { "type": "subscribe", "channel": "activity", "filters": { "agent_id": "oracle" } }
Event:      { "type": "event", "channel": "tasks", "data": { ... } }
```

### Webhook events

External systems can register to receive HTTP POST callbacks for: `task.created`, `task.status_changed`, `task.completed`, `comment.created`, `mention.received`, `standup.generated`, `agent.error`, `agent.health_changed`.

---

## 14. Database schema design

SQUIDJOB's primary database uses **Convex** for real-time subscriptions and reactive queries, with PostgreSQL + pgvector as an alternative for customers requiring SQL compatibility. The schema below is expressed in Convex's TypeScript schema definition format.

```typescript
// ─── TENANT & AUTH ───
tenants: defineTable({
  name: v.string(),
  plan: v.union(v.literal("starter"), v.literal("professional"), v.literal("enterprise")),
  settings: v.object({ timezone: v.string(), heartbeatInterval: v.number(), /* ... */ }),
  createdAt: v.number(),
})

users: defineTable({
  tenantId: v.id("tenants"),
  email: v.string(),
  name: v.string(),
  role: v.union(v.literal("owner"), v.literal("admin"), v.literal("operator"), v.literal("viewer")),
}).index("by_tenant", ["tenantId"])

// ─── BYOK API KEYS ───
apiKeys: defineTable({
  tenantId: v.id("tenants"),
  provider: v.string(),           // "anthropic", "openai", "google", etc.
  encryptedKey: v.bytes(),        // Envelope-encrypted with KMS
  keyVaultRef: v.optional(v.string()), // For enterprise customer-managed vaults
  lastRotated: v.number(),
  isActive: v.boolean(),
}).index("by_tenant_provider", ["tenantId", "provider"])

// ─── AGENTS ───
agents: defineTable({
  tenantId: v.id("tenants"),
  name: v.string(),
  role: v.string(),
  soulMd: v.string(),             // SOUL.md content
  agentsMd: v.string(),           // Operating instructions
  toolsMd: v.string(),            // Capabilities config
  heartbeatMd: v.string(),        // Heartbeat checklist
  modelConfig: v.object({ provider: v.string(), model: v.string(), temperature: v.number() }),
  level: v.union(v.literal("intern"), v.literal("specialist"), v.literal("lead")),
  status: v.union(v.literal("active"), v.literal("idle"), v.literal("error"), v.literal("disabled")),
  isDefault: v.boolean(),         // true for the 10 pre-configured agents
  createdAt: v.number(),
}).index("by_tenant", ["tenantId"])
  .index("by_tenant_status", ["tenantId", "status"])

// ─── TASKS ───
tasks: defineTable({
  tenantId: v.id("tenants"),
  title: v.string(),
  description: v.string(),
  status: v.union(v.literal("inbox"), v.literal("assigned"), v.literal("in_progress"),
                  v.literal("review"), v.literal("done")),
  isBlocked: v.boolean(),
  blockerReason: v.optional(v.string()),
  blockedBy: v.optional(v.string()),
  blockedAt: v.optional(v.number()),
  blockedUntil: v.optional(v.number()),
  unblockOwner: v.optional(v.string()),
  priority: v.union(v.literal("critical"), v.literal("high"), v.literal("medium"), v.literal("low")),
  assignees: v.array(v.id("agents")),
  createdBy: v.string(),
  parentTask: v.optional(v.id("tasks")),
  tags: v.array(v.string()),
  dueDate: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_tenant_status", ["tenantId", "status"])
  .index("by_tenant_assignee", ["tenantId", "assignees"])

// ─── COMMENTS & THREADS ───
comments: defineTable({
  tenantId: v.id("tenants"),
  taskId: v.id("tasks"),
  authorId: v.string(),
  content: v.string(),
  mentions: v.array(v.string()),
  parentCommentId: v.optional(v.id("comments")),
  createdAt: v.number(),
}).index("by_task", ["tenantId", "taskId"])

// ─── ACTIVITY FEED ───
activities: defineTable({
  tenantId: v.id("tenants"),
  actorId: v.string(),
  action: v.string(),
  targetType: v.string(),         // "task", "agent", "comment", etc.
  targetId: v.string(),
  metadata: v.any(),
  createdAt: v.number(),
}).index("by_tenant_time", ["tenantId", "createdAt"])

// ─── SESSIONS & MEMORY ───
sessions: defineTable({
  tenantId: v.id("tenants"),
  agentId: v.id("agents"),
  sessionKey: v.string(),
  conversationBuffer: v.string(), // JSON serialized messages
  compactionSummary: v.optional(v.string()),
  tokenCount: v.number(),
  modelConfig: v.object({ provider: v.string(), model: v.string() }),
  status: v.union(v.literal("active"), v.literal("idle"), v.literal("archived")),
  lastActiveAt: v.number(),
  createdAt: v.number(),
}).index("by_tenant_agent", ["tenantId", "agentId"])
  .index("by_session_key", ["sessionKey"])

memoryEntries: defineTable({
  tenantId: v.id("tenants"),
  agentId: v.id("agents"),
  memoryType: v.union(v.literal("long_term"), v.literal("working"), v.literal("daily_note")),
  content: v.string(),
  embedding: v.optional(v.array(v.float64())), // For vector search
  date: v.optional(v.string()),   // For daily notes: YYYY-MM-DD
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_agent_type", ["tenantId", "agentId", "memoryType"])
  .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 768 })

// ─── DELIVERABLES ───
deliverables: defineTable({
  tenantId: v.id("tenants"),
  taskId: v.id("tasks"),
  agentId: v.id("agents"),
  fileName: v.string(),
  fileRef: v.string(),            // Convex file storage reference or S3 key
  mimeType: v.string(),
  sizeBytes: v.number(),
  createdAt: v.number(),
}).index("by_task", ["tenantId", "taskId"])

// ─── SCHEDULING ───
cronJobs: defineTable({
  tenantId: v.id("tenants"),
  agentId: v.id("agents"),
  name: v.string(),
  schedule: v.string(),           // Cron expression or ISO timestamp
  scheduleType: v.union(v.literal("cron"), v.literal("at"), v.literal("interval")),
  executionMode: v.union(v.literal("main_session"), v.literal("isolated")),
  command: v.string(),
  modelOverride: v.optional(v.string()),
  isActive: v.boolean(),
  lastRunAt: v.optional(v.number()),
  nextRunAt: v.number(),
  retryCount: v.number(),
}).index("by_tenant", ["tenantId"])
  .index("by_next_run", ["isActive", "nextRunAt"])

// ─── USAGE TRACKING ───
usageRecords: defineTable({
  tenantId: v.id("tenants"),
  agentId: v.id("agents"),
  date: v.string(),               // YYYY-MM-DD
  tokensIn: v.number(),
  tokensOut: v.number(),
  apiCalls: v.number(),
  estimatedCost: v.number(),      // In USD
}).index("by_tenant_date", ["tenantId", "date"])

// ─── NOTIFICATIONS ───
notifications: defineTable({
  tenantId: v.id("tenants"),
  recipientId: v.string(),        // Agent ID or user ID
  recipientType: v.union(v.literal("agent"), v.literal("user")),
  type: v.union(v.literal("mention"), v.literal("assignment"), v.literal("review_request"),
                v.literal("status_change"), v.literal("standup")),
  sourceTaskId: v.optional(v.id("tasks")),
  sourceCommentId: v.optional(v.id("comments")),
  message: v.string(),
  isRead: v.boolean(),
  createdAt: v.number(),
}).index("by_recipient", ["tenantId", "recipientId", "isRead"])

// ─── TELEGRAM INTEGRATION ───
telegramConnections: defineTable({
  tenantId: v.id("tenants"),
  botTokenRef: v.string(),        // reference to encrypted secret or vault pointer
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_tenant", ["tenantId"])

telegramChatLinks: defineTable({
  tenantId: v.id("tenants"),
  userId: v.id("users"),
  telegramChatId: v.string(),     // chat ID to deliver notifications
  createdAt: v.number(),
}).index("by_user", ["tenantId", "userId"])

telegramOutboundQueue: defineTable({
  tenantId: v.id("tenants"),
  chatId: v.string(),
  notificationId: v.optional(v.id("notifications")),
  message: v.string(),
  status: v.union(v.literal("queued"), v.literal("sent"), v.literal("failed")),
  retryCount: v.number(),
  lastError: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_status", ["tenantId", "status", "createdAt"])

// ─── STANDUPS ───
standups: defineTable({
  tenantId: v.id("tenants"),
  date: v.string(),               // YYYY-MM-DD
  summary: v.string(),            // LLM-generated narrative
  perAgentSummaries: v.array(v.object({
    agentId: v.id("agents"),
    completed: v.array(v.string()),
    inProgress: v.array(v.string()),
    blockers: v.array(v.string()),
  })),
  deliveredTo: v.array(v.string()), // Channels where standup was sent
  createdAt: v.number(),
}).index("by_tenant_date", ["tenantId", "date"])
```

---

## 15. Phased delivery roadmap

### Phase 1 — Core foundation (Months 1-3)

**Goal**: Ship a working MVP that proves the value proposition — customers can deploy a coordinated agent squad and manage it through Mission Control.

- Multi-tenant infrastructure with starter-tier isolation (shared schema + RLS)
- BYOK API key management for Anthropic and OpenAI (encrypted storage, model routing)
- 5 of 10 default agents (Oracle, Strategist, Scribe, Forge, Detective)
- Session management with auto-compaction and basic memory (SOUL.md + WORKING.md)
- Task lifecycle (Kanban board with all five status columns)
- Mission Control UI: Dashboard, Kanban Board, Agent Roster, basic Activity Feed
- Heartbeat system with configurable intervals
- Basic cron scheduling (cron expressions, main-session mode)
- REST API with core endpoints (agents, tasks, activity)
- Usage tracking and basic cost dashboard

**Success metric**: 10 beta customers running 5-agent squads with <2% error rate on agent turns.

### Phase 2 — Advanced orchestration (Months 4-6)

**Goal**: Full feature parity with the OpenClaw Mission Control reference, plus SaaS-specific enhancements.

- Remaining 5 default agents (Architect, Scout, Courier, Herald, Librarian)
- Custom sub-agent creation (Agent Builder UI with SoulCraft wizard)
- QMD-inspired hybrid memory search (BM25 + vector + reranking)
- @Mentions and thread subscriptions with real-time notifications
- Daily standup generation and delivery (email, Slack, webhooks)
- Comment threads on tasks with inter-agent discussion
- Document storage for deliverables (Convex file storage or S3)
- Isolated cron sessions with model overrides
- Additional LLM provider support (Google, Mistral, Groq)
- Professional-tier isolation (schema-per-tenant, gVisor sandboxing)
- Webhook integrations for external system connectivity
- WebSocket real-time subscriptions

**Success metric**: 50+ paying customers, average 8 agents per squad, daily standup adoption >70%.

### Phase 3 — Scale and enterprise (Months 7-12)

**Goal**: Enterprise readiness, advanced optimization, and ecosystem expansion.

- Enterprise-tier isolation (dedicated databases, Firecracker microVMs, customer-managed key vaults)
- Advanced token optimization (LLMLingua-style compression, semantic caching, prompt caching integration)
- Agent skill marketplace (community-contributed agent templates and capabilities)
- Multi-squad management (enterprises running multiple independent squads)
- Advanced analytics (agent performance metrics, cost optimization recommendations, ROI tracking)
- SOC 2 Type II certification
- SSO/SAML integration for enterprise identity providers
- Custom model fine-tuning integration (bring your own fine-tuned models)
- Agent-to-agent collaboration protocols (structured peer review, consensus mechanisms)
- Mobile app (iOS/Android) for monitoring and notifications
- Self-hosted deployment option for air-gapped environments

**Success metric**: 500+ customers, enterprise contracts signed, <100ms p95 API latency, 99.9% uptime.

---

## 16. Technology stack recommendations

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | React + Vite + Tailwind CSS | Proven stack, excellent DX, strong Convex integration |
| **Real-time Database** | Convex | Reactive subscriptions, built-in vector search, V8 isolate functions, TypeScript-native. Offers free Professional tier for OpenClaw ecosystem projects |
| **Relational Database** | PostgreSQL + pgvector | Alternative/complement to Convex for SQL-heavy queries and enterprise deployments |
| **Session Cache** | Redis (Valkey) | Sub-millisecond session state access, pub/sub for real-time events, streams for task queues |
| **Object Storage** | AWS S3 / GCS | Deliverables, archived sessions, large memory files |
| **API Gateway** | AWS API Gateway or Kong | Rate limiting, auth, tenant routing, WAF integration |
| **Compute** | AWS ECS Fargate / GKE | Container orchestration with auto-scaling |
| **Sandboxing** | gVisor (runsc) / Firecracker | Syscall-level isolation (Pro) / hardware isolation (Enterprise) |
| **Key Management** | AWS KMS + Secrets Manager | Envelope encryption for BYOK API keys |
| **Search & Embeddings** | pgvector or Convex vector search | Memory retrieval, QMD-style hybrid search |
| **Monitoring** | Datadog / Grafana + Prometheus | Agent health, API latency, token usage, cost tracking |
| **CI/CD** | GitHub Actions | Automated testing, deployment, infrastructure-as-code |
| **Auth** | Convex Auth / Auth0 / Clerk | Multi-tenant authentication with RBAC |

The technology choice between Convex and PostgreSQL is not either/or. **Convex excels as the primary data layer** for its reactive subscriptions (eliminating the need for custom WebSocket infrastructure) and developer experience. PostgreSQL serves as the **analytical and compliance layer** for complex queries, reporting, and enterprise audit requirements. Both share the same logical schema, synchronized via Convex's built-in HTTP actions or an event bridge.

---

## 17. Cost and token optimization strategies

Token costs are the dominant variable expense for SQUIDJOB customers. The platform's value proposition depends on making agent squads affordable to run. The optimization strategy operates across five layers, with cumulative savings of **70-90%** compared to naive implementations.

**Layer 1 — Intelligent retrieval (50-70% savings)**. The QMD-inspired hybrid search pipeline ensures agents receive only the most relevant memories and context, rather than loading entire memory files. A 50,000-token MEMORY.md yields ~1,000 tokens of injected context.

**Layer 2 — Model tiering (40-60% cost reduction)**. Not every agent turn requires the most powerful model. Heartbeat checks, standup data collection, memory maintenance, and simple routing decisions use lightweight models (Haiku, GPT-4o-mini). Complex reasoning and creative tasks escalate to frontier models. SQUIDJOB's orchestration engine automatically selects the appropriate model tier based on task complexity signals.

**Layer 3 — Session management (30-50% savings)**. Auto-compaction with memory flush prevents unbounded context growth. Isolated cron sessions avoid polluting main sessions with recurring task history. Session idle timeout releases resources for inactive agents.

**Layer 4 — Caching and deduplication (20-40% savings)**. Prompt caching (available from Anthropic and OpenAI) is automatically leveraged for the SOUL.md and system instruction prefix, which remains identical across turns. Semantic response caching avoids redundant LLM calls for similar queries. Nightly memory deduplication merges overlapping entries.

**Layer 5 — Structural optimization (10-20% savings)**. Compact HEARTBEAT.md files, structured (JSON/YAML) prompting where appropriate, and aggressive pruning of low-information content from context windows.

**Per-agent daily cost estimate** (with all optimizations applied):

| Activity | Turns/Day | Avg Tokens/Turn | Model | Est. Daily Cost |
|----------|-----------|-----------------|-------|----------------|
| Heartbeat checks | 48 (every 15 min, 12 hrs) | 800 | Haiku | $0.04 |
| Task work | 10 | 6,000 | Sonnet/GPT-4o | $0.60 |
| Collaboration | 5 | 3,000 | Sonnet/GPT-4o | $0.15 |
| Memory maintenance | 2 | 2,000 | Haiku | $0.01 |
| **Total per agent** | | | | **~$0.80/day** |
| **10-agent squad** | | | | **~$8.00/day** |

These estimates assume Anthropic pricing as of early 2026, with prompt caching enabled. Actual costs vary significantly based on task complexity and model choice.

---

## 18. Scalability from 10 to 10,000 tenants

SQUIDJOB's architecture is designed to scale horizontally across three dimensions.

**Compute scaling**: The Agent Orchestration Engine runs as stateless containers behind a load balancer. Adding capacity means adding containers. Session state lives in Redis and Convex, not in the container process. The Cron Scheduler uses a distributed lock (Redis SETNX) to prevent duplicate job execution across multiple instances. Agent tool execution in sandboxed containers can be scaled independently from the orchestration layer.

**Data scaling**: Convex's architecture horizontally scales function execution via V8 isolates (10ms spin-up vs 500ms+ for Lambda cold starts). For PostgreSQL deployments, read replicas handle dashboard queries while the primary handles writes. Per-tenant database sharding (at enterprise tier) provides unlimited horizontal data scaling. Vector indexes are partitioned by tenant namespace for isolated, parallelizable search.

**Tenant scaling**: The shared-schema-with-RLS approach supports thousands of small tenants on a single database instance. As tenants grow, they are migrated to dedicated schemas or dedicated instances without downtime — a "graduated isolation" pattern. Tenant routing at the API gateway ensures requests hit the correct data shard without application-level routing logic.

### Operational limits and guardrails

| Resource | Starter | Professional | Enterprise |
|----------|---------|-------------|-----------|
| Max agents per tenant | 15 | 50 | Unlimited |
| Max concurrent sessions | 5 | 20 | 100 |
| Heartbeat minimum interval | 15 min | 5 min | 1 min |
| API rate limit | 100 req/min | 1,000 req/min | 10,000 req/min |
| Storage per tenant | 1 GB | 10 GB | 100 GB |
| Session history retention | 30 days | 90 days | Configurable |

---

## Conclusion: what makes SQUIDJOB defensible

Three architectural decisions create SQUIDJOB's competitive moat. First, the **QMD-inspired hybrid memory search** pipeline (BM25 + vector + RRF + reranking) is significantly more sophisticated than the simple "load entire file" approach most agent frameworks use — it delivers better agent reasoning at a fraction of the token cost. Second, the **graduated multi-tenant isolation model** (shared → gVisor → Firecracker) lets SQUIDJOB serve startups and enterprises from the same codebase without the security compromises of one-size-fits-all isolation. Third, the **BYOK model with intelligent cost optimization** aligns SQUIDJOB's incentives with its customers': the platform earns subscription revenue from orchestration value, not markup on API calls, so every token saved is a genuine customer benefit.

The phased roadmap prioritizes proving the core loop first — agents coordinating through a shared database, managed through a beautiful Kanban UI, with daily standups providing accountability. Advanced features like the hybrid memory pipeline, agent skill marketplace, and enterprise isolation follow only after the core experience is validated. This is not a platform for running a single chatbot. It is the infrastructure for running an autonomous workforce.
