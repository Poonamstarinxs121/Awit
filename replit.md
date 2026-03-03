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
- **Skills**: Marketplace, Packs
- **Infrastructure**: Machines, Terminal
- **Workspace**: Boards, Docs, Standups, Approvals
- **System**: Org, Settings, Billing, Help

## Recent Changes (Phase 17 — SaaS Admin Console)
- **2 new DB columns**: `status` (`active`/`suspended`/`trial`, default `active`) and `subdomain` (nullable text) added to `tenants` via idempotent `ALTER TABLE IF NOT EXISTS`
- **6 new admin API endpoints**: `GET /admin/v1/finance` (MRR/ARR/plan breakdown/monthly signups), `GET /admin/v1/tenants/:id/invoices` (live Stripe invoice list), `GET /admin/v1/tenants/:id/users`, `POST /admin/v1/tenants` (manual onboarding), `PATCH /admin/v1/tenants/:id/status`, `DELETE /admin/v1/tenants/:id` (requires suspended state)
- **`AdminShell.tsx`**: Self-contained admin layout — collapsible sidebar (220px/60px), `#111111` bg, Platform/Tenants/Finance nav sections, topbar breadcrumb, user avatar, sign-out. Completely separate from workspace Dock/Layout.
- **`AdminDashboard.tsx`** (`/admin`): Rebuilt with AdminShell — 4 stat cards (total/active/trial tenants + MRR), 3 plan distribution cards with revenue bars, full tenants table with inline plan dropdown + suspend/activate toggle
- **`TenantsListPage.tsx`** (`/admin/tenants`): Search + Plan/Status filters, full tenant table, slide-in onboard panel (creates tenant+owner user+subscription), delete flow requiring suspended state
- **`TenantDetailPage.tsx`** (`/admin/tenants/:id`): 4 tabs — Overview (usage stats + sub info), Billing & Invoices (live Stripe invoices table + Stripe dashboard link), Users (read-only list), Actions (change plan, suspend/activate, danger zone delete with name confirmation)
- **`FinancePage.tsx`** (`/admin/finance`): MRR/ARR/subscriber stat cards, plan revenue breakdown with progress bars, monthly new-tenant bar chart (SVG, no library), subscriptions table, usage cost leaderboard
- **`AdminRoute` guard** in `App.tsx`: Redirects non-admins to `/admin/login`; `/admin/dashboard` → redirects to `/admin`
- **`stripeService.ts`**: Added `getCustomerInvoices(customerId)` helper

## Recent Changes (Phase 16 — Skills Marketplace)
- **4 new DB tables**: `skill_packs`, `skills`, `installed_skills`, `agent_skills` with full indexes and idempotent seed
- **21 built-in skills** seeded across 2 packs: SquidJob Core Skills (15) and SquidJob Communication Skills (6)
- **`/v1/marketplace` API**: Full CRUD for skills, packs, and agent-skill assignments (install/uninstall/enable/disable)
- **MarketplacePage** (`/marketplace`): Sortable/filterable table of all skills with SAFE/MODERATE/HIGH risk badges, install/uninstall actions
- **PacksPage** (`/packs`): Pack management with stat cards, inline add form, sync, and delete with confirmation
- **AgentDetail Skills tab**: Toggle individual installed skills on/off per agent; linked to Marketplace for empty state
- **Orchestration injection**: `loadAgentSkills()` appends enabled skills' `tools_md` to agent system prompt (both standard and streaming turn paths)
- **Dock**: New "Skills" section with Marketplace + Packs links; Board inner sidebar updated with same links
- **Routing**: `/marketplace` and `/packs` routes added to App.tsx

## Previous Changes (Phase 15 — Bug Fixes & API Audit)
- **CronJobs API**: `GET /v1/cron-jobs` now returns `{ jobs: [...] }` instead of raw array — fixes WorkflowsPage and WeeklyCalendar empty states
- **WeeklyCalendar**: Fixed interface field names (`cron_expression→schedule`, `enabled→is_active`) to match actual DB schema
- **Memory /nodes endpoint**: Added `GET /v1/memory-graph/nodes?query=` route with content filtering — fixes SearchPage 404 on memory search
- **Dead analytics route removed**: Deleted `server/src/routes/analytics.ts` (queried non-existent `activity_log` table) and unmounted it from `index.ts`
- **Organisation page**: Now fetches real plan/status from `/v1/billing/history` API with graceful fallback instead of hardcoded "Starter"
- **Dashboard warning banner**: Shows dismissible amber banner when no LLM provider is configured, linking to Settings

## Previous Changes (Phase 14 — Machines Redesign + Agent Detail Redesign + Layout Cleanup)
- **AppSidebar removed**: Was causing a duplicate sidebar alongside the Dock. Layout now uses only Dock + main content. marginLeft = dockWidth only.
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