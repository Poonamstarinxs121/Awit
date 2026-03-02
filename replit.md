# SquidJob - Multi-Agent AI Orchestration Platform

## Overview
SquidJob is a multi-tenant SaaS platform designed to orchestrate independent AI agents into cohesive, coordinated teams. It enables customers to bring their own API keys (BYOK) for various LLM providers and offers a comprehensive platform including an orchestration layer, a "Mission Control" UI, a shared database, and robust agent management capabilities. The platform's vision is to streamline complex AI workflows, enhance productivity, and enable advanced automation through intelligent agent collaboration.

## User Preferences
- Warm light theme (MissionControlHQ-inspired)
- Cream background (#FAF7F2), gold accent (#C4943D), purple for Telegram (#7C3AED)
- White cards with warm borders (#E5E1D8), subtle shadows
- Monorepo structure with separate server/ and client/ directories

## System Architecture
SquidJob is built as a monorepo with distinct `server/` and `client/` directories.

**Technology Stack:**
- **Frontend**: React, Vite, Tailwind CSS (port 5000)
- **Backend**: Node.js, Express, TypeScript (port 3001)
- **Database**: PostgreSQL (28+ tables, multi-tenancy enforced)
- **Authentication**: JWT with tenant_id, bcryptjs for passwords, RBAC (Owner/Admin/Operator/Viewer)
- **LLM Integration**: OpenAI SDK supporting OpenAI, Anthropic, Google Gemini, Mistral, Groq (BYOK), and Ollama (local LLM).
- **Real-time**: WebSocket layer using PostgreSQL LISTEN/NOTIFY.
- **Search**: pgvector + BM25 hybrid memory search with Reciprocal Rank Fusion.
- **File Storage**: Multer-based file uploads.

**Core Architectural Features & Design Patterns:**

-   **Multi-tenancy**: Implemented at the database level with `tenant_id` on all relevant tables and enforced via JWT claims and RLS policies (MVP uses WHERE clauses).
-   **Agent Orchestration Engine**: Manages agent turn loops, message processing, session context, and inter-agent communication with loop prevention.
-   **QMD Hybrid Memory Search**: Combines BM25 and vector search (pgvector with HNSW index) using Reciprocal Rank Fusion for efficient and relevant memory retrieval.
-   **Dynamic Context Window Allocation**: A token budget allocator intelligently sizes context sections based on LLM model limits.
-   **Heartbeat System**: Staggered scheduling of agent heartbeats using cheaper models to maintain agent status.
-   **Cron Scheduler Engine**: Parses cron expressions and executes scheduled jobs with retry backoff mechanisms.
-   **SoulCraft Wizard**: An LLM-assisted UI for generating and editing `SOUL.md` personality configurations for agents.
-   **SSH Machine Management**: Allows credential encryption (AES-256), CRUD operations for machines and groups, remote command execution, and health monitoring. Agent orchestration can inject machine context and execute commands.
-   **WhatsApp Integration**: Via Twilio REST API, enabling inbound messages to be routed to a Lead Agent (Oracle) for processing.
-   **UI/UX**: Features a dark-themed Mission Control dashboard with a warm light theme option, including specific color palettes for cream, gold, and purple accents. It includes a Kanban board for task management, an Agent Builder, and analytics dashboards.
-   **Security**: BYOK API keys are encrypted with AES-256.

**Key Features:**
-   **Core Platform**: Multi-tenant auth, 10 default AI agents per tenant, task lifecycle management, agent configuration via SOUL.md, BYOK API key management, activity feed, and a dark-themed Mission Control dashboard.
-   **Agent Intelligence**: Live streaming chat, context-aware orchestration, session management with auto-compaction, heartbeat system, QMD memory search, dynamic token budgeting, inter-agent messaging, and an LLM-assisted Agent Builder.
-   **Automation & Scheduling**: Cron scheduler with UI management per agent, and auto-generated daily standups.
-   **Integrations & Delivery**: Webhook system with HMAC signing, Telegram integration for notifications and inbound messages, standup delivery (Email, Slack, Telegram), and @mention notification system.
-   **Data & Analytics**: Usage dashboard, agent performance analytics, deliverable storage, and real-time WebSocket layer.
-   **Infrastructure Management**: SSH machine registry, machine health monitoring, and agent machine context injection.

## External Dependencies
-   **LLM Providers**: OpenAI, Anthropic, Google Gemini, Mistral, Groq (via BYOK), Ollama (local LLM).
-   **Database**: PostgreSQL with `pgvector` extension.
-   **Real-time Communication**: PostgreSQL LISTEN/NOTIFY.
-   **Email Service**: Resend (for standup delivery).
-   **Messaging Platforms**:
    -   Twilio (for WhatsApp integration).
    -   Telegram Bot API (for notifications and inbound messages).
    -   Slack (webhooks for standup delivery).
-   **Authentication**: bcryptjs.
-   **SSH Connectivity**: `ssh2` npm package.
-   **File Uploads**: Multer.

## Demo Credentials
- **SaaS Admin**: admin@squidjob.com / admin123 (login at /admin/login)
- **Tenant Member**: kaustubh@awitmedia.com / member123 (login at /login)

## Workflows
- **SquidJob Client**: `cd client && npm run dev` (port 5000, webview)
- **SquidJob Server**: `cd /home/runner/workspace/server && npx tsx watch src/index.ts` (port 3001)

## Key Routes (Frontend)
- `/` Dashboard, `/kanban` Kanban, `/agents` Agents, `/agents/:id` Agent Detail, `/agents/new` New Agent
- `/standups` Standups, `/settings` Settings, `/documents` Documents, `/squad-chat` Squad Chat
- `/memory-graph` Memory Graph, `/machines` Infrastructure (Machines + Groups), `/help` Help Center
- `/setup` Setup Wizard, `/setup/provisioning` Provisioning, `/subscription` Subscription

## Key API Endpoints
- **Auth**: POST /auth/register, /auth/login, GET /auth/me
- **Agents**: GET/POST /v1/agents, PATCH /v1/agents/:id, POST /v1/agents/:id/message (SSE streaming), POST /v1/agents/:id/heartbeat, GET /v1/agents/:id/analytics, POST /v1/agents/generate-soul
- **Tasks**: GET/POST /v1/tasks, PATCH /v1/tasks/:id, POST /v1/tasks/:id/comments, POST/GET /v1/tasks/:id/deliverables, GET /v1/deliverables/:id/download
- **Machines**: GET/POST /v1/machines, PATCH/DELETE /v1/machines/:id, POST /v1/machines/:id/ping, POST /v1/machines/:id/exec, GET/POST /v1/machines/groups, PATCH/DELETE /v1/machines/groups/:id, POST /v1/machines/groups/:id/exec
- **WhatsApp**: GET /v1/whatsapp/config, POST /v1/whatsapp/connect, DELETE /v1/whatsapp/disconnect, POST /v1/whatsapp/test, POST /v1/whatsapp/webhook (PUBLIC — Twilio callback)
- **Telegram**: GET/POST /v1/telegram/config, POST /v1/telegram/connect, DELETE /v1/telegram/disconnect, GET/POST /v1/telegram/chats, POST /v1/telegram/test
- **Config**: GET/POST/DELETE /v1/config/providers, GET /v1/config/usage
- **Cron Jobs**: GET/POST /v1/cron-jobs, PATCH/DELETE /v1/cron-jobs/:id, POST /v1/cron-jobs/:id/trigger
- **Standups**: GET /v1/standups, GET/PUT /v1/standups/delivery-config
- **Webhooks**: GET/POST /v1/webhooks, PATCH/DELETE /v1/webhooks/:id, GET /v1/webhooks/:id/deliveries
- **Notifications**: GET /v1/notifications, PATCH /v1/notifications/:id/read, POST /v1/notifications/read-all
- **Documents**: GET/POST /v1/documents, GET/PATCH/DELETE /v1/documents/:id
- **Squad Chat**: GET/POST /v1/squad-chat/messages
- **Memory Graph**: GET /v1/memory-graph/nodes, GET /v1/memory-graph/edges
- **Settings**: POST /v1/settings/pause-all, POST /v1/settings/resume-all
- **Setup**: POST /v1/setup/complete

## Recent Changes (Phase 5 — 2026-03-02)
- **Ollama Local LLM**: 6th provider option; key stored as host URL (http://localhost:11434); client uses baseURL/v1 with dummy apiKey='ollama'; usage tracking skipped (no cost); AgentBuilder has Ollama model chips (llama3.3, llama3.1, mistral, qwen2.5, deepseek-r1, phi4); Settings shows host URL field instead of API key
- **SSH Machine Registry**: `machine_groups` + `machines` DB tables; `sshService.ts` (AES-256 cred encryption, ssh2 npm); CRUD + ping + exec + group fan-out at /v1/machines
- **Machine Health Monitor**: `machineMonitorService.ts` — pings all machines every 60s, updates status=online/offline
- **Agent Machine Context**: `orchestrationEngine.ts` injects machine list into Oracle's system prompt; detects `[EXEC mac-mini-1: cmd]` patterns post-LLM; runs SSH; second LLM turn interprets output
- **WhatsApp via Twilio**: `whatsapp_configs` DB table; `whatsappService.ts` (Twilio REST, no SDK); /v1/whatsapp routes (PUBLIC webhook before authMiddleware); inbound messages routed to Oracle via orchestration engine
- **Machines UI**: `/machines` page — Machines tab (status dots, ping, terminal modal) + Groups tab (fan-out exec); "Infrastructure" nav section in Sidebar