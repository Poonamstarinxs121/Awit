# SquidJob - Multi-Agent AI Orchestration Platform

## Overview
SquidJob is a multi-tenant SaaS platform designed to orchestrate independent AI agents into cohesive, coordinated teams. It enables customers to bring their own API keys (BYOK) for various LLM providers and offers a comprehensive platform including an orchestration layer, a "Mission Control" UI, a shared database, and robust agent management capabilities. The platform's vision is to streamline complex AI workflows, enhance productivity, and enable advanced automation through intelligent agent collaboration.

## User Preferences
- Dark macOS-inspired shell — Phase 7 tenacitOS migration
- Background (#0C0C0C), accent red (#FF3B30), dark cards (#1A1A1A), dark borders (#2A2A2A)
- Inter (body) + JetBrains Mono (mono) + Sora (headings) fonts
- Shell: 68px Dock (left) + 48px TopBar + 32px StatusBar (bottom)
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

-   **Multi-tenancy**: Implemented at the database level with `tenant_id` and enforced via JWT claims and RLS policies.
-   **Agent Orchestration Engine**: Manages agent turn loops, message processing, session context, and inter-agent communication with loop prevention.
-   **QMD Hybrid Memory Search**: Combines BM25 and vector search using Reciprocal Rank Fusion for efficient memory retrieval.
-   **Dynamic Context Window Allocation**: A token budget allocator intelligently sizes context sections based on LLM model limits.
-   **Heartbeat System**: Staggered scheduling of agent heartbeats using cheaper models to maintain agent status.
-   **Cron Scheduler Engine**: Parses cron expressions and executes scheduled jobs with retry backoff mechanisms.
-   **SoulCraft Wizard**: An LLM-assisted UI for generating and editing `SOUL.md` personality configurations for agents.
-   **SSH Machine Management**: Allows credential encryption (AES-256), CRUD operations for machines and groups, remote command execution, and health monitoring. Agent orchestration can inject machine context and execute commands.
-   **WhatsApp Integration**: Via Twilio REST API, enabling inbound messages to be routed to a Lead Agent (Oracle) for processing.
-   **UI/UX**: Features a dark-themed Mission Control dashboard with specific color palettes and a warm light theme option. Includes a Kanban board, Agent Builder, and analytics dashboards.
-   **Security**: BYOK API keys are encrypted with AES-256.
-   **SaaS Admin Console**: Provides tools for managing tenants, plans, and usage for SaaS administrators.
-   **API Tokens**: Supports `sqj_` prefixed API tokens for authentication, stored with SHA-256 hashing.
-   **Stripe Billing**: Integrates with Stripe for subscription management, checkout sessions, and billing portals.
-   **Approval Flows**: Implements approval workflows with pending/approved/rejected states and a dedicated UI for management.
-   **Board Groups**: Organizes tasks into board groups with filtering capabilities in the Kanban view.
-   **Activity Timeline**: Provides a comprehensive event timeline with filtering by event type and pagination.

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
-   **Payment Processing**: Stripe.

## Routing
- `/` — Public landing page (unauthenticated) or redirect to `/dashboard` (authenticated)
- `/dashboard` — Main dashboard (protected, inside Layout shell)
- `/login`, `/register` — Auth pages (public, dark theme)
- `/subscription` — Plan management (protected, standalone dark page)
- Protected routes inside Layout shell:
  - `/dashboard`, `/boards`, `/kanban` (unified Board), `/agents`, `/agents/new`, `/agents/:id`
  - `/standups`, `/settings`, `/documents`, `/machines`, `/approvals`
  - `/activity` (enhanced LogsPage with terminal UI), `/system`, `/sessions`
  - `/costs`, `/analytics`, `/calendar`, `/terminal`
  - `/automation` (merged Cron+Webhooks), `/search`, `/actions`, `/about`
  - `/memory` (MemoryGraph), `/help`

## Dock Navigation (Left, 68px)
- **Core**: Dashboard, System, Agents, Sessions, Activity
- **Intelligence**: Analytics, Costs, Memory, Search
- **Automation**: Automation (cron+webhooks), Calendar
- **Infrastructure**: Machines, Terminal
- **Workspace**: Boards, Docs, Standups, Approvals
- **System**: Settings, Billing, Help

## Recent Changes (Phase 11 — App-Wide Consolidation Audit)
- **9 pages removed** — eliminated all redundancy and duplicate features
- **LogsPage → Activity** (`/activity`): Kept tenacitOS terminal UI (JetBrains Mono, syntax highlighting, auto-scroll, export). Merged Activity.tsx filter chips (Task Created, Agent Message, Heartbeat, Cron, SSH, Approval, etc.) + relative time display. Deleted Activity.tsx.
- **WorkflowsPage → Automation** (`/automation`): Kept tenacitOS polished tabbed dashboard with stats cards + webhooks tab. Merged CronPage's full CRUD (create/delete jobs, agent selector). Fixed broken field mappings (`schedule`/`is_active`). Deleted CronPage.tsx.
- **Standups** (`/standups`): Already had `delivered_to` channel display. Deleted ReportsPage.tsx (duplicate data source).
- **Documents** (`/documents`): Full CRUD with categories already complete. Deleted FilesPage.tsx (read-only stub).
- **Removed stubs**: SkillsPage (redundant with Agents), GitPage (empty placeholder)
- **Removed orphans**: Kanban.tsx, SquadChat.tsx (replaced by Board.tsx + BoardChat.tsx in Phase 10)
- **MemoryGraph**: Consolidated from dual routes (`/memory-graph` + `/memory`) to single `/memory`
- **Dock reorganized**: Removed 7 dead entries (Logs, Cron, Reports, Files, Git, Skills, duplicate Memory), clean 6-section layout

## Previous Changes (Phase 10 — Unified Board + Chat)
- **Unified Board Page**: Merged Squad Chat and Kanban into single `Board.tsx` with split layout — Kanban columns left + Board Chat panel right + Agents sidebar
- **Board Chat Panel**: `client/src/components/board/BoardChat.tsx` — persistent chat in right panel with @mention autocomplete for agents, keyboard navigation, 5s polling
- **@mention Agent Routing**: Backend POST `/v1/squad-chat/messages` now parses @AgentName mentions, routes to named agent (or lead agent as fallback), posts agent responses back to chat

## Previous Changes (Phase 9 — Landing + Subscription)
- **Public Landing Page**: `LandingPage.tsx` at `/` for unauthenticated users; purple (#7C3AED) + brown + offwhite + yellow palette
- **Subscription Page Redesign**: Dark-themed with plan cards and upgrade/downgrade buttons
- **Dark Theme Cleanup**: All light-theme class remnants replaced with CSS var equivalents