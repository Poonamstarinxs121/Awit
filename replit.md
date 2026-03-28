# SquidJob - Multi-Agent AI Orchestration Platform

## Overview
SquidJob is a multi-tenant SaaS platform designed to orchestrate independent AI agents into cohesive, coordinated teams. It enables customers to bring their own API keys (BYOK) for various LLM providers and offers a comprehensive platform including an orchestration layer, a "Mission Control" UI, a shared database, and robust agent management capabilities. The platform's vision is to streamline complex AI workflows, enhance productivity, and enable advanced automation through intelligent agent collaboration.

## User Preferences
- Dark macOS-inspired shell — Phase 7 tenacitOS migration
- Background (#0C0C0C), accent red (#FF3B30), dark cards (#1A1A1A), dark borders (#2A2A2A)
- Inter (body) + JetBrains Mono (mono) + Sora (headings) fonts
- Shell: Collapsible Dock (68px collapsed / 240px expanded, left) + 48px TopBar + 32px StatusBar (bottom)
- Mobile responsive: 768px breakpoint, Dock becomes overlay with hamburger toggle, StatusBar hidden on mobile
- Monorepo structure with separate server/, client/, node/, and extension/ directories

## System Architecture
SquidJob uses a **Hub + Node** architecture:
- **Hub** (this app): Central VPS with React/Vite + Express/PostgreSQL for fleet dashboard, 3D Office, board memory, task dispatch, fleet search, and fleet analytics.
- **Node** (per machine): Next.js app running alongside OpenClaw for agent discovery, system monitoring, hub synchronization, file browsing, memory editing, session/cost tracking, cron management, and terminal access.
- **Chrome Extension**: Lightweight fleet status viewer with background polling, notifications, and badge counts.

The codebase is a monorepo with `server/`, `client/`, `node/`, and `extension/` directories.

**Technology Stack:**
- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with `pgvector` extension (Hub), SQLite via better-sqlite3 (Node)
- **Authentication**: JWT, bcryptjs, RBAC (Owner/Admin/Operator/Viewer)
- **LLM Integration**: OpenAI SDK supporting OpenAI, Anthropic, Google Gemini, Mistral, Groq (BYOK), and Ollama (local LLM).
- **Real-time**: WebSocket layer using PostgreSQL LISTEN/NOTIFY.
- **Search**: pgvector + BM25 hybrid memory search with Reciprocal Rank Fusion (Hub); text-based local search across files/sessions/memories (Node).
- **File Storage**: Multer-based file uploads (Hub); filesystem API with path traversal protection (Node).
- **Code Editor**: Monaco Editor (@monaco-editor/react) in Node file browser and memory browser.
- **Chrome Extension**: Manifest V3, vanilla JS, no build step.

**Core Architectural Features & Design Patterns:**
- **Multi-tenancy**: Implemented at the database level with `tenant_id` and enforced via JWT claims and RLS policies.
- **Agent Orchestration Engine**: Manages agent turn loops, message processing, session context, and inter-agent communication with loop prevention.
- **QMD Hybrid Memory Search**: Combines BM25 and vector search using Reciprocal Rank Fusion.
- **Dynamic Context Window Allocation**: A token budget allocator intelligently sizes context sections based on LLM model limits.
- **Heartbeat System**: Staggered scheduling of agent heartbeats using cheaper models to maintain agent status.
- **Cron Scheduler Engine**: Parses cron expressions and executes scheduled jobs with retry backoff mechanisms.
- **SoulCraft Wizard**: An LLM-assisted UI for generating and editing `SOUL.md` personality configurations for agents.
- **SSH Machine Management**: Allows credential encryption (AES-256), CRUD operations for machines and groups, remote command execution, and health monitoring.
- **WhatsApp Integration**: Via Twilio REST API, enabling inbound messages to be routed to a Lead Agent (Oracle).
- **UI/UX**: Features a dark-themed Mission Control dashboard with specific color palettes and a warm light theme option, including a Kanban board, Agent Builder, and analytics dashboards.
- **Security**: BYOK API keys are encrypted with AES-256; API tokens use SHA-256 hashing.
- **SaaS Admin Console**: Provides tools for managing tenants, plans, and usage for SaaS administrators.
- **Stripe Billing**: Integrates with Stripe for subscription management, checkout sessions, and billing portals.
- **Onboarding Wizard**: Multi-step setup wizard at `/setup` guiding new tenant admins through LLM provider, Telegram, WhatsApp, Discord, first agent creation, node registration, and provisioning. Progress persisted to localStorage; optional steps skippable; re-runnable from Settings > General.
- **Approval Flows**: Implements approval workflows with pending/approved/rejected states and a dedicated UI.
- **Board Groups**: Organizes tasks into board groups with filtering capabilities in the Kanban view.
- **Activity Timeline**: Provides a comprehensive event timeline with filtering by event type and pagination.
- **Organisation Chart**: Hierarchical team tree at `/org-chart` — builds from flat agents using manager_id, shows avatar/name/job_title/status/model/level per node, expand/collapse, department grouping, compact stats strip, click-through opens agent config side panel. Features: drag-and-drop connector for setting hierarchy (drag from one agent to another to create manager_id link), right-click context menu to remove from hierarchy, cycle prevention, node selector (Hub vs fleet nodes) for viewing per-machine org structures. Side panel allows editing job_title, department, level, status, model/provider, and soul_md inline with save.
- **Calendar (Enhanced)**: Three-view calendar at `/calendar` — List (upcoming events grouped by day), Weekly (7-column grid with colored event pills), Monthly (month grid with overflow). Sources: `calendar_events` table + tasks with due_date + active cron jobs. Event creation modal via `POST /v1/calendar-events`. Event types: meeting (gold), followup (green), reminder (purple), task (blue), cron (orange), event (teal).
- **Help Center Extended**: Two new topics under "USING YOUR SQUAD" — "Agent Memory System" (shared workspace meeting files, per-agent MEMORY.md, SOUL.md identity) and "Power Commands" ("do it now" override bypasses delegation).
- **Task Dispatch**: Hub dispatches tasks to specific nodes with full lifecycle tracking (pending→dispatched→accepted→running→completed/failed).
- **Cross-Machine Agent Routing**: When @mentioning an agent that exists on a remote node, the Hub automatically creates a cross-node dispatch.
- **Fleet-Wide Search**: Fan-out search to all online nodes + Hub memory, with per-source result grouping.
- **Fleet Analytics**: Aggregated cost/usage analytics across Hub and all nodes with daily trends, per-model/per-agent breakdowns.
- **Node-to-Node Messaging**: Hub-relayed inter-node messaging supporting agent_request, search_request, status_request, and custom message types.
- **Node Dispatch Worker**: Polls Hub for pending dispatches, executes tasks locally, reports results back.
- **Node Local Search**: Searches across agent memory files, filesystem, and SQLite session history.

## Hub DB Tables (Phase 3+4)
- `task_dispatches` — dispatched tasks to nodes with lifecycle status tracking
- `node_messages` — Hub-relayed inter-node messages with pending/delivered/processed/failed states
- `tasks.target_node_id` — optional node targeting column on tasks table

## Node SQLite Tables
- `sessions` — local session history (agent_id, model, tokens, status, timestamps)
- `costs` — per-session cost records (agent_id, model, tokens, estimated_cost)
- `activity` — local activity log (event_type, description, metadata)
- `sync_state` — tracks last telemetry sync timestamp for Hub sync
- `setup_config` — key-value config store for setup wizard (key, value, updated_at)

## Node Pages
- `/setup` — First-run setup wizard (7 steps: Welcome, Hub Connection, Admin Password, Node Identity, LLM API, Messaging, Launch)
- `/` — Dashboard with system stats, agent overview, recent activity
- `/agents` — Agent list from OpenClaw discovery
- `/system` — System monitor (CPU, RAM, disk, network)
- `/files` — File browser with Monaco editor, directory tree, breadcrumbs
- `/memory` — Memory browser for agent .md files (SOUL, AGENTS, TOOLS, MEMORY, HEARTBEAT, IDENTITY)
- `/sessions` — Session history with stats, filters, inline expansion
- `/costs` — Cost tracking with breakdowns, daily trend SVG chart
- `/activity` — Application activity log with event filtering, agent filtering, and metadata display
- `/cron` — Cron manager for OpenClaw scheduled tasks
- `/terminal` — Command execution terminal with history, quick commands

## Hub Pages (Phase 3+4+6)
- `/fleet-analytics` — Aggregated cross-node cost/usage analytics
- SearchPage Fleet tab — Cross-node search with per-source grouping
- Board task detail — Dispatch to Node section with status timeline
- Fleet node detail — Recent Dispatches section
- `/office` — Hub 3D Office with full Office3D (VoxelAvatars, furniture, FPS/orbit modes)
- `/fleet/nodes/:nodeId/office` — Per-node 3D Office view with system metrics overlay
- `/fleet-office` — Fleet-wide multi-node 3D overview (all nodes as separate rooms)

## Office3D Components (Phase 6)
Located in `client/src/components/Office3D/` — 22 components extracted from tenacitOS:
- `Office3D.tsx` — Main scene accepting dynamic `OfficeAgent[]` props
- `types.ts` — Shared interfaces (`OfficeAgent`, `OfficeAgentWithPosition`), helpers (`mapStatusForOffice`, `assignAgentColor`, `calculateDeskPositions`)
- `VoxelAvatar.tsx`, `AgentDesk.tsx`, `AgentPanel.tsx`, `MovingAvatar.tsx` — Agent rendering/interaction
- `Floor.tsx`, `Walls.tsx`, `Lights.tsx` — Environment
- `CoffeeMachine.tsx`, `FileCabinet.tsx`, `Whiteboard.tsx`, `PlantPot.tsx`, `WallClock.tsx` — Furniture
- `FirstPersonControls.tsx` — WASD FPS camera mode
- `VoxelChair.tsx`, `VoxelKeyboard.tsx`, `VoxelMacMini.tsx` — Desk accessories
- `ProceduralAvatars.tsx`, `Avatar.tsx`, `AvatarModel.tsx`, `useAvatarModel.ts`, `agentsConfig.ts` — Avatar system

## Downloads
- `GET /v1/downloads/node` — Streams `node/` directory as `squidjob-node.zip` (excludes node_modules, .next, .env, .git)
- `GET /v1/downloads/extension` — Streams `extension/` directory as `squidjob-extension.zip` (excludes node_modules, .env, .git)
- Settings page has a "Downloads" tab with download buttons and quick-start guides for both
- Fleet registration flow includes a "Download Node App" button
- Help Center has "Node Setup" and "Browser Setup" topics with download links

## Hub API Endpoints (Phase 3+4)
- `POST /v1/tasks/:id/dispatch` — dispatch task to node
- `GET /v1/tasks/:id/dispatch` — get dispatch status
- `GET /v1/tasks/dispatch-by-node/:nodeId` — dispatches for a node
- `PATCH /v1/task-dispatches/:id` — node updates dispatch status
- `GET /v1/nodes/:id/dispatches` — list pending dispatches for a node
- `POST /v1/fleet/search` — fleet-wide search fan-out
- `GET /v1/fleet/analytics/costs` — aggregated fleet costs
- `GET /v1/fleet/analytics/usage` — aggregated fleet usage
- `POST /v1/nodes/:id/messages` — send message to another node
- `GET /v1/nodes/:id/messages/inbox` — poll incoming messages
- `PATCH /v1/node-messages/:id` — mark message delivered/processed

## Node Self-Update System
- `GET /api/update` — returns update state (version, logs, backupPath, state)
- `POST /api/update { action: 'check' }` — fetches latest version from Hub's `/v1/version`
- `POST /api/update { action: 'start', downloadUrl? }` — starts update (backup→pause→download→extract→install→resume)
- `POST /api/update { action: 'rollback' }` — restores SQLite DB from backup, resumes services
- `POST /api/update { action: 'reset' }` — clears error state
- State persisted to `$OPENCLAW_DIR/update-state.json`; backups kept in `$OPENCLAW_DIR/backups/` (last 5 kept)
- Services paused during update via `services_paused` flag in SQLite sync_state; hub-sync + dispatch-worker check this flag
- Manual update also available via `node/scripts/squidjob-update.sh` (v1.0.0)
- Hub serves `GET /v1/version` (public) returning `{ nodeVersion, hubVersion }` for version checks

## Node API Endpoints
- `GET /api/agents` — list discovered agents
- `GET /api/agents/:id` — agent detail
- `GET /api/system/stats` — system metrics
- `GET /api/health` — health check
- `GET /api/hub/status` — hub connection status
- `GET /api/files?path=` — list directory
- `GET /api/files/read?path=` — read file
- `PUT /api/files/write` — write file
- `GET /api/sessions` — list sessions
- `GET /api/sessions/:id` — session detail
- `GET /api/costs` — cost summary
- `GET /api/costs/daily` — daily cost breakdown
- `GET /api/activity` — activity feed
- `GET /api/cron` — cron tasks
- `POST /api/terminal/exec` — execute command
- `GET /api/search?q=` — local search
- `GET /api/dispatches` — local dispatch history
- `GET /api/setup/status` — check if setup wizard has been completed
- `POST /api/setup/save` — save wizard config to SQLite + .env file
- `POST /api/setup/test-hub` — test Hub connectivity with provided credentials
- `POST /api/setup/reset` — clear setup completion flag (requires auth)

## Chrome Extension (`extension/`)
- Manifest V3, vanilla JS, no build step
- Popup: fleet status viewer with node cards (CPU/RAM/disk bars), agent roster, summary counts
- Background: polls Hub every 60s, sends notifications on node status changes, updates badge count
- Options: Hub URL + API key configuration, notification toggles, poll interval selector

## External Dependencies
- **LLM Providers**: OpenAI, Anthropic, Google Gemini, Mistral, Groq, Ollama.
- **Database**: PostgreSQL with `pgvector` extension (Hub); SQLite via better-sqlite3 (Node).
- **Real-time Communication**: PostgreSQL LISTEN/NOTIFY.
- **Email Service**: Resend.
- **Messaging Platforms**: Twilio (for WhatsApp), Telegram Bot API, Slack (webhooks).
- **Authentication**: bcryptjs.
- **SSH Connectivity**: `ssh2` npm package.
- **File Uploads**: Multer.
- **Payment Processing**: Stripe.
- **Code Editor**: @monaco-editor/react (Node file/memory browser).
