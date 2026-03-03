# SquidJob - Multi-Agent AI Orchestration Platform

## Overview
SquidJob is a multi-tenant SaaS platform designed to orchestrate independent AI agents into cohesive, coordinated teams. It enables customers to bring their own API keys (BYOK) for various LLM providers and offers a comprehensive platform including an orchestration layer, a "Mission Control" UI, a shared database, and robust agent management capabilities. The platform's vision is to streamline complex AI workflows, enhance productivity, and enable advanced automation through intelligent agent collaboration.

## User Preferences
- Dark macOS-inspired shell — Phase 7 tenacitOS migration
- Background (#0C0C0C), accent red (#FF3B30), dark cards (#1A1A1A), dark borders (#2A2A2A)
- Inter (body) + JetBrains Mono (mono) + Sora (headings) fonts
- Shell: Collapsible Dock (68px collapsed / 220px expanded, left) + 48px TopBar + 32px StatusBar (bottom)
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
- `/login`, `/register` — Auth pages (public, dark theme)
- `/subscription` — Plan management (protected, standalone dark page)
- Protected routes inside Layout shell:
  - `/dashboard`, `/boards`, `/kanban` (unified Board with inner sidebar+toolbar), `/agents`, `/agents/new`, `/agents/:id`
  - `/standups`, `/settings`, `/documents`, `/machines`, `/approvals`
  - `/activity` (LogsPage — terminal UI + filter chips), `/system`, `/sessions`
  - `/costs`, `/analytics`, `/calendar`, `/terminal`
  - `/automation` (merged Cron+Webhooks), `/search`, `/actions`, `/about`
  - `/memory` (MemoryGraph), `/help`, `/organisation`

## Dock Navigation (Left, 68px)
- **Core**: Dashboard, System, Agents, Sessions, Activity
- **Intelligence**: Analytics, Costs, Memory, Search
- **Automation**: Automation (cron+webhooks), Calendar
- **Infrastructure**: Machines, Terminal
- **Workspace**: Boards, Docs, Standups, Approvals
- **System**: Org, Settings, Billing, Help

## Recent Changes (Phase 14 — Global AppSidebar + Machines Redesign + Agent Detail Redesign)
- **Global AppSidebar**: Extracted Board's inner sidebar into `client/src/components/shell/AppSidebar.tsx` — now rendered on ALL pages via Layout.tsx (220px, fixed, between Dock and main content). Has Personal/Organisation workspace switcher, grouped nav sections (Navigation, Boards, Skills, Administration) with expand/collapse, live agent list with status dots.
- **Layout updated**: Total left offset = dockWidth + 220px (AppSidebar). TopBar and StatusBar adjust to full offset.
- **Board.tsx**: Removed inner BoardSidebar (now global). Renamed "Mission Control" → "Boards". Dock Boards link → `/kanban`.
- **Machines page redesign**: Stat cards (total/online/offline/groups), table-style machine list with status glow dots, slide-in panels for add/edit/terminal (replacing Modals), SSH terminal output in dark terminal window.
- **Agent Detail redesign**: Hero header card with avatar + status glow + level badge, vertical tab sidebar grouped into INTERACT/CONFIGURE/AUTOMATE, save button in each card header, model config with provider dropdown + temperature slider.
- **Dock**: Expand/collapse tab on right edge (visible pull tab), section headers when expanded, icon+label when collapsed, theme picker + user menu popups.

## Previous Changes (Phase 13 — Board Redesign + Organisation Page + Consolidation Completion)
- **Board.tsx Redesign**: Added structured left inner sidebar (200px) with Personal/Organisation workspace switcher dropdown, NAVIGATION/BOARDS/SKILLS/ADMINISTRATION nav sections, agents list with status dots. Toolbar with Board/List view toggle, +Add, Play/Pause, Filter, Copy, Edit, Settings, Chat icons. Improved task cards with priority color strips + assignee initials.
- **Organisation Page** (`/organisation`): New page with 4 stat cards, org details + subscription info, team members list, API providers status, permissions/roles grid. Added to Dock System section and `/organisation` route.
- **Phase 11 Consolidation Complete**: All 9 orphaned pages removed (Activity, CronPage, ReportsPage, FilesPage, SkillsPage, GitPage, Kanban, SquadChat, duplicate memory route). Final page count: ~32 pages.
- **Standups Enhancement**: Delivery channel badges (email/slack/telegram) shown with distinct colored pill badges (blue/red/blue).
- **Documents Enhancement**: Added informational banner explaining task file attachments are in Board task detail panels.

## Previous Changes (Phase 12 — Settings, Billing, Dock, StatusBar, Theming)
- **Settings Page**: Complete UI/UX redesign with tabbed layout (General, Integrations, Security, Notifications).
- **Billing Page**: Billing schedule timeline, payment details panel, stat cards. New `/v1/billing/history` endpoint.
- **Dock User Menu**: Single-letter initials circle at bottom; popup with name/email/role/tenant, theme picker, Sign Out.
- **Theme System**: 4 themes (Dark, Midnight Blue, Nord, Warm Light). Persisted in localStorage.
- **StatusBar Upgrade**: Machine health metrics (CPU%/RAM/DSK%), SVC count, Uptime timer, connection glow dot.
## Previous Changes (Phase 11 — App-Wide Consolidation)
- LogsPage → `/activity` (terminal UI + filter chips). WorkflowsPage → `/automation` (merged cron CRUD). Standups kept `delivered_to`. Documents kept full CRUD. Removed 9 redundant/orphaned pages. Dock reorganized into 6 clean sections. Memory route consolidated to `/memory` only.

## Previous Changes (Phase 10 — Unified Board + Chat)
- Merged Squad Chat + Kanban into `Board.tsx`. `BoardChat.tsx` with @mention agent routing. Backend routes @AgentName mentions to named agent or lead agent fallback.

## Previous Changes (Phase 9 — Landing + Subscription)
- Public `LandingPage.tsx` at `/`. Dark-themed Subscription page. Theme cleanup across all pages.