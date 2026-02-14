# SquidJob - Multi-Agent AI Orchestration Platform

## Overview
SquidJob is a multi-tenant SaaS platform that orchestrates independent AI agents into coordinated teams. Customers bring their own API keys (BYOK), and the platform provides the orchestration layer, Mission Control UI, shared database, and agent management.

**Company**: Awit Media Private Limited
**Product**: SquidJob.com
**Current State**: MVP with live agent orchestration

## Architecture

### Stack
- **Frontend**: React + Vite + Tailwind CSS (port 5000)
- **Backend**: Node.js + Express + TypeScript (port 3001)
- **Database**: PostgreSQL with 15 tables (tenants, users, agents, tasks, comments, activities, sessions, memory_entries, deliverables, cron_jobs, usage_records, notifications, standups, audit_log, api_keys)
- **Auth**: JWT with tenant_id in claims, bcryptjs password hashing
- **LLM**: OpenAI SDK (supports OpenAI + Anthropic via BYOK)
- **Real-time**: Planned WebSocket layer using PostgreSQL LISTEN/NOTIFY

### Project Structure
```
/
├── server/                 # Express API server
│   ├── src/
│   │   ├── index.ts       # Entry point (port 3001)
│   │   ├── db/            # PostgreSQL pool, migrations
│   │   ├── middleware/     # Auth, tenant context, error handler
│   │   ├── routes/        # REST API routes (auth, agents, tasks, activity, standups, config)
│   │   ├── services/      # Business logic
│   │   │   ├── authService.ts        # Registration, login
│   │   │   ├── agentService.ts       # Agent CRUD, default seeding
│   │   │   ├── configService.ts      # BYOK key encryption/storage
│   │   │   ├── llmProviderClient.ts  # LLM API calls (OpenAI/Anthropic), streaming, usage tracking
│   │   │   ├── sessionManager.ts     # Session lifecycle, context assembly, compaction
│   │   │   ├── orchestrationEngine.ts # Agent turn loop, message processing
│   │   │   ├── heartbeatService.ts   # Periodic agent heartbeat worker
│   │   │   ├── activityService.ts    # Activity logging
│   │   │   ├── taskService.ts        # Task operations
│   │   │   └── tenantService.ts      # Tenant operations
│   │   └── types/         # TypeScript interfaces
│   └── package.json
├── client/                 # React SPA (Mission Control UI)
│   ├── src/
│   │   ├── api/           # Fetch-based API client
│   │   ├── components/    # Layout, Sidebar, AgentChat, UI components
│   │   ├── context/       # Auth context
│   │   ├── hooks/         # Custom hooks
│   │   ├── pages/         # Dashboard, Kanban, Agents, AgentDetail (with Chat), Settings
│   │   └── types/         # Frontend types
│   └── package.json
├── docs/                   # Architecture documentation
└── replit.md              # This file
```

### Key Features (MVP)
1. Multi-tenant auth with JWT + RBAC (Owner/Admin/Operator/Viewer)
2. 5 default AI agents seeded per tenant (Oracle, Strategist, Scribe, Forge, Detective)
3. Task lifecycle management (Kanban: Inbox → Assigned → In Progress → Review → Done)
4. Agent configuration with SOUL.md personality editing
5. BYOK API key management with AES-256 encryption
6. Activity feed and audit logging
7. Dark-themed Mission Control dashboard
8. **Live Agent Chat** - Send messages to agents and get streaming responses
9. **Agent Orchestration Engine** - Context-aware agent turns with SOUL + memory + tasks
10. **Session Management** - Persistent conversation history with auto-compaction
11. **Heartbeat System** - Periodic agent check-ins using HEARTBEAT.md checklists
12. **Usage Tracking** - Token counting and cost estimation per agent per day

### Agent Orchestration Flow
1. User sends message via POST /v1/agents/:id/message
2. Orchestration engine loads agent config (SOUL, instructions, capabilities)
3. Session manager retrieves/creates conversation session
4. Context assembled: system prompt + memories + active tasks + history
5. LLM called via BYOK key (OpenAI/Anthropic)
6. Response streamed back to client via SSE
7. Usage tracked in usage_records table
8. Activity logged for audit trail

### API Endpoints
- POST /auth/register, /auth/login, GET /auth/me
- GET/POST /v1/agents, GET/PATCH /v1/agents/:id
- POST /v1/agents/:id/message (send message, supports streaming)
- GET /v1/agents/:id/history (conversation history)
- DELETE /v1/agents/:id/history (clear conversation)
- POST /v1/agents/:id/heartbeat (trigger manual heartbeat)
- GET/POST /v1/tasks, GET/PATCH /v1/tasks/:id, POST /v1/tasks/:id/comments
- GET /v1/tasks/stats
- GET /v1/activity
- GET /v1/standups, GET /v1/standups/latest
- GET/POST/DELETE /v1/config/providers, GET /v1/config/usage

### Workflows
- **SquidJob Client**: `cd client && npm run dev` (port 5000, webview)
- **SquidJob Server**: `cd /home/runner/workspace/server && npx tsx watch src/index.ts` (port 3001)

### Database
- PostgreSQL with 15 tables, all with tenant_id for multi-tenancy
- RLS policies created but MVP uses direct WHERE clause filtering
- Indexes on all frequently queried columns

### Demo Credentials
- **SaaS Admin**: admin@squidjob.com / admin123 (login at /admin/login)
- **Tenant Member**: kaustubh@awitmedia.com / member123 (login at /login)

## User Preferences
- Dark theme SaaS aesthetic
- Deep ocean blue primary (#0A1628), teal for success (#14B8A6), blue accent (#2563EB)
- Monorepo structure with separate server/ and client/ directories

## Recent Changes
- 2026-02-14: Added agent orchestration engine, LLM provider client, session manager, heartbeat system, and chat UI
- 2026-02-14: Initial MVP build - full project structure, database, auth, API, and frontend
