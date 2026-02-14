# SquidJob - Multi-Agent AI Orchestration Platform

## Overview
SquidJob is a multi-tenant SaaS platform that orchestrates independent AI agents into coordinated teams. Customers bring their own API keys (BYOK), and the platform provides the orchestration layer, Mission Control UI, shared database, and agent management.

**Company**: Awit Media Private Limited
**Product**: SquidJob.com
**Current State**: Phase 2 complete - full-featured agent orchestration platform

## Architecture

### Stack
- **Frontend**: React + Vite + Tailwind CSS (port 5000)
- **Backend**: Node.js + Express + TypeScript (port 3001)
- **Database**: PostgreSQL with 20+ tables (tenants, users, agents, tasks, comments, activities, sessions, memory_entries, cron_jobs, usage_records/usage_logs, notifications, standups, audit_log, api_keys, thread_subscriptions, task_deliverables, webhooks, webhook_deliveries, telegram_configs, telegram_chat_links, telegram_notification_queue, tenant_settings)
- **Auth**: JWT with tenant_id in claims, bcryptjs password hashing, RBAC (Owner/Admin/Operator/Viewer)
- **LLM**: OpenAI SDK (supports OpenAI, Anthropic, Google Gemini, Mistral, Groq via BYOK)
- **Real-time**: WebSocket layer using PostgreSQL LISTEN/NOTIFY
- **Search**: pgvector + BM25 hybrid memory search with Reciprocal Rank Fusion
- **File Storage**: Multer-based file uploads stored on disk

### Project Structure
```
/
├── server/                 # Express API server
│   ├── src/
│   │   ├── index.ts       # Entry point (port 3001)
│   │   ├── db/            # PostgreSQL pool, migrations
│   │   ├── middleware/     # Auth, RBAC, tenant context, error handler
│   │   ├── routes/        # REST API routes
│   │   │   ├── auth.ts, agents.ts, tasks.ts, standups.ts
│   │   │   ├── activity.ts, config.ts, cronJobs.ts
│   │   │   ├── webhooks.ts, telegram.ts, deliverables.ts
│   │   │   └── index.ts   # Route registry
│   │   ├── services/      # Business logic
│   │   │   ├── authService.ts        # Registration, login
│   │   │   ├── agentService.ts       # Agent CRUD, default seeding (10 agents)
│   │   │   ├── configService.ts      # BYOK key encryption/storage
│   │   │   ├── llmProviderClient.ts  # LLM API calls (5 providers), streaming, usage
│   │   │   ├── sessionManager.ts     # Session lifecycle, context, compaction
│   │   │   ├── orchestrationEngine.ts # Agent turn loop, message processing
│   │   │   ├── heartbeatService.ts   # Staggered agent heartbeats
│   │   │   ├── cronScheduler.ts      # Cron expression parser, job executor
│   │   │   ├── memorySearchService.ts # QMD hybrid search (BM25+vector+RRF)
│   │   │   ├── interAgentService.ts  # Inter-agent messaging with loop prevention
│   │   │   ├── threadService.ts      # Thread subscriptions, comment notifications
│   │   │   ├── notificationService.ts # @mention parsing, notification creation
│   │   │   ├── realtimeService.ts    # WebSocket + PG LISTEN/NOTIFY
│   │   │   ├── webhookService.ts     # Webhook registration, event firing, delivery
│   │   │   ├── telegramService.ts    # Bot connection, chat linking, messaging
│   │   │   ├── standupService.ts     # Daily standup generation
│   │   │   ├── standupDeliveryService.ts # Email/Slack/Telegram delivery
│   │   │   ├── deliverableService.ts # File upload/download/storage
│   │   │   ├── tokenBudgetAllocator.ts # Dynamic context window allocation
│   │   │   ├── analyticsService.ts   # Per-agent performance metrics
│   │   │   ├── activityService.ts    # Activity logging
│   │   │   ├── taskService.ts        # Task operations
│   │   │   └── tenantService.ts      # Tenant operations
│   │   └── types/         # TypeScript interfaces
│   └── package.json
├── client/                 # React SPA (Mission Control UI)
│   ├── src/
│   │   ├── api/           # Fetch-based API client (apiGet/Post/Patch/Put/Delete)
│   │   ├── components/    # UI components
│   │   │   ├── Layout.tsx, Sidebar.tsx, ProtectedRoute.tsx
│   │   │   ├── AgentChat.tsx         # Streaming chat with agents
│   │   │   ├── AgentBuilder.tsx      # SoulCraft wizard (5-step agent creation)
│   │   │   ├── AgentAnalytics.tsx    # Per-agent metrics dashboard
│   │   │   ├── CronJobManager.tsx    # Cron job CRUD per agent
│   │   │   ├── NotificationBell.tsx  # Real-time notification dropdown
│   │   │   └── ui/                   # Card, Button, Input, Modal, Badge, Spinner
│   │   ├── context/       # Auth context
│   │   ├── hooks/         # Custom hooks
│   │   ├── pages/         # Dashboard, Kanban, Agents, AgentDetail, AgentNew, Standups, Settings
│   │   └── types/         # Frontend types
│   └── package.json
├── uploads/               # File storage for deliverables (gitignored)
├── docs/                  # Architecture documentation
└── replit.md             # This file
```

### Key Features
**Core Platform:**
1. Multi-tenant auth with JWT + RBAC (Owner/Admin/Operator/Viewer)
2. 10 default AI agents seeded per tenant (Oracle, Strategist, Scribe, Forge, Detective, Architect, Scout, Courier, Herald, Librarian)
3. Task lifecycle management (Kanban: Inbox → Assigned → In Progress → Review → Done)
4. Agent configuration with SOUL.md personality editing
5. BYOK API key management with AES-256 encryption (5 providers)
6. Activity feed and audit logging
7. Dark-themed Mission Control dashboard

**Agent Intelligence:**
8. Live Agent Chat with streaming responses (SSE)
9. Agent Orchestration Engine with context-aware turns
10. Session Management with auto-compaction
11. Heartbeat System with staggered scheduling and cheaper models
12. QMD Hybrid Memory Search (BM25 + pgvector + RRF)
13. Token Budget Allocator - dynamic context window allocation
14. Inter-Agent Messaging with loop prevention (max depth 3)
15. Agent Builder UI with SoulCraft wizard (LLM-assisted SOUL.md generation)

**Automation & Scheduling:**
16. Cron Scheduler Engine with expression parsing and retry backoff
17. Cron Job Management UI per agent
18. Auto-generated Daily Standups with LLM narratives

**Integrations & Delivery:**
19. Webhook System with HMAC signing and delivery tracking
20. Telegram Integration (bot connection, chat linking, notifications)
21. Standup Delivery Channels (Email via Resend, Slack webhooks, Telegram)
22. @Mention Notification System with auto-responses
23. Thread Subscriptions with comment notifications

**Data & Analytics:**
24. Usage Dashboard with visual charts
25. Agent Performance Analytics (completion rate, token efficiency, cost trends)
26. Deliverable Storage (file upload/download on tasks)
27. WebSocket Real-time Layer (PG LISTEN/NOTIFY)

### Agent Orchestration Flow
1. User sends message via POST /v1/agents/:id/message
2. Orchestration engine loads agent config (SOUL, instructions, capabilities)
3. Session manager retrieves/creates conversation session
4. Token budget allocator sizes context sections based on model limits
5. QMD hybrid search retrieves relevant memories (BM25 + vector + RRF)
6. Context assembled: system prompt + memories + active tasks + history
7. LLM called via BYOK key (OpenAI/Anthropic/Gemini/Mistral/Groq)
8. Response streamed back to client via SSE
9. Embeddings generated async for new memories
10. Usage tracked, activity logged, webhooks fired

### API Endpoints
**Auth:** POST /auth/register, /auth/login, GET /auth/me
**Agents:** GET/POST /v1/agents, GET/PATCH /v1/agents/:id
- POST /v1/agents/:id/message (streaming chat)
- GET /v1/agents/:id/history, DELETE /v1/agents/:id/history
- POST /v1/agents/:id/heartbeat (manual heartbeat)
- POST /v1/agents/:id/collaborate (inter-agent messaging)
- GET /v1/agents/:id/analytics
- GET /v1/agents/analytics (all agents overview)
- POST /v1/agents/generate-soul (SoulCraft LLM generation)
**Tasks:** GET/POST /v1/tasks, GET/PATCH /v1/tasks/:id
- POST /v1/tasks/:id/comments, GET /v1/tasks/stats
- POST/GET /v1/tasks/:id/deliverables
- GET /v1/deliverables/:id/download
**Cron Jobs:** GET/POST /v1/cron-jobs, PATCH/DELETE /v1/cron-jobs/:id, POST /v1/cron-jobs/:id/trigger
**Standups:** GET /v1/standups, GET /v1/standups/latest
- GET/PUT /v1/standups/delivery-config
**Activity:** GET /v1/activity
**Config:** GET/POST/DELETE /v1/config/providers, GET /v1/config/usage
**Webhooks:** GET/POST /v1/webhooks, PATCH/DELETE /v1/webhooks/:id, GET /v1/webhooks/:id/deliveries
**Telegram:** GET /v1/telegram/config, POST /v1/telegram/connect, DELETE /v1/telegram/disconnect
- GET/POST /v1/telegram/chats, POST /v1/telegram/test
**Notifications:** GET /v1/notifications, PATCH /v1/notifications/:id/read, POST /v1/notifications/read-all

### Workflows
- **SquidJob Client**: `cd client && npm run dev` (port 5000, webview)
- **SquidJob Server**: `cd /home/runner/workspace/server && npx tsx watch src/index.ts` (port 3001)

### Database
- PostgreSQL with 20+ tables, all with tenant_id for multi-tenancy
- pgvector extension for embedding-based memory search (HNSW index)
- GIN indexes for full-text search on memory content
- RLS policies created, MVP uses direct WHERE clause filtering
- Indexes on all frequently queried columns

### Demo Credentials
- **SaaS Admin**: admin@squidjob.com / admin123 (login at /admin/login)
- **Tenant Member**: kaustubh@awitmedia.com / member123 (login at /login)

## User Preferences
- Dark theme SaaS aesthetic
- Deep ocean blue primary (#0A1628), teal for success (#14B8A6), blue accent (#2563EB)
- Monorepo structure with separate server/ and client/ directories

## Recent Changes
- 2026-02-14: Phase 2 complete - All 20 features built:
  - RBAC enforcement, cron scheduler, auto-standups, usage dashboard, WebSocket real-time
  - Staggered heartbeats, 5 additional agents, @mention notifications, inter-agent messaging
  - Thread subscriptions, SoulCraft wizard, QMD hybrid memory search, cron job UI
  - Google Gemini/Mistral/Groq providers, deliverable storage, webhook system
  - Telegram integration, standup delivery channels, token budget allocator, agent analytics
- 2026-02-14: Phase 1 MVP - full project structure, database, auth, API, frontend, agent chat
