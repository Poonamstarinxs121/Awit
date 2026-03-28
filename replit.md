# SquidJob - Multi-Agent AI Orchestration Platform

## Overview
SquidJob is a multi-tenant SaaS platform designed to orchestrate independent AI agents into cohesive, coordinated teams. It enables customers to bring their own API keys (BYOK) for various LLM providers and offers a comprehensive platform including an orchestration layer, a "Mission Control" UI, a shared database, and robust agent management capabilities. The platform's vision is to streamline complex AI workflows, enhance productivity, and enable advanced automation through intelligent agent collaboration, unlocking advanced automation and leveraging the collective intelligence of AI agents.

## User Preferences
- Dark macOS-inspired shell — Phase 7 tenacitOS migration
- Background (#0C0C0C), accent red (#FF3B30), dark cards (#1A1A1A), dark borders (#2A2A2A)
- Inter (body) + JetBrains Mono (mono) + Sora (headings) fonts
- Shell: Collapsible Dock (68px collapsed / 240px expanded, left) + 48px TopBar + 32px StatusBar (bottom)
- Mobile responsive: 768px breakpoint, Dock becomes overlay with hamburger toggle, StatusBar hidden on mobile
- Monorepo structure with separate server/, client/, node/, and extension/ directories

## System Architecture
SquidJob utilizes a **Hub + Node** architecture:
- **Hub**: Central VPS managing fleet dashboard, 3D Office, board memory, task dispatch, fleet search, and analytics.
- **Node**: Per-machine application for agent discovery, system monitoring, hub synchronization, file browsing, memory editing, session/cost tracking, cron management, and terminal access.
- **Chrome Extension**: Lightweight fleet status viewer with background polling, notifications, and badge counts.

The codebase is structured as a monorepo containing `server/`, `client/`, `node/`, and `extension/` directories.

**Technology Stack:**
- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with `pgvector` (Hub), SQLite (Node)
- **Authentication**: JWT, bcryptjs, RBAC
- **LLM Integration**: OpenAI SDK supporting multiple providers (BYOK), and Ollama.
- **Real-time**: WebSocket layer using PostgreSQL LISTEN/NOTIFY.
- **Search**: `pgvector` + BM25 hybrid memory search with Reciprocal Rank Fusion (Hub); text-based local search (Node).
- **File Storage**: Multer-based file uploads (Hub); filesystem API (Node).
- **Code Editor**: Monaco Editor (Node).

**Core Architectural Features & Design Patterns:**
- **Multi-tenancy**: Database-level implementation with `tenant_id` and RLS policies.
- **Agent Orchestration Engine**: Manages agent workflows, message processing, and inter-agent communication.
- **QMD Hybrid Memory Search**: Combines BM25 and vector search.
- **Dynamic Context Window Allocation**: Token budget allocator for LLM context.
- **Heartbeat System**: Staggered scheduling of agent heartbeats using cheaper models.
- **Cron Scheduler Engine**: Executes scheduled jobs with retry mechanisms.
- **SoulCraft Wizard**: LLM-assisted UI for `SOUL.md` personality configurations.
- **SSH Machine Management**: Credential encryption, CRUD for machines, remote command execution, health monitoring.
- **WhatsApp Integration**: Via Twilio REST API for routing inbound messages.
- **UI/UX**: Dark-themed Mission Control with Kanban, Agent Builder, analytics, and a warm light theme option.
- **Security**: AES-256 encryption for BYOK API keys; SHA-256 hashing for API tokens.
- **SaaS Admin Console**: Tools for managing tenants, plans, and usage.
- **Stripe Billing**: Integration for subscription management and billing.
- **Onboarding Wizard**: Multi-step setup for new tenant admins, including LLM provider, messaging, and agent creation.
- **Approval Flows**: Implements approval workflows with UI.
- **Board Groups**: Organizes tasks in Kanban view.
- **Activity Timeline**: Comprehensive event timeline with filtering.
- **Organisation Chart**: Hierarchical team tree with drag-and-drop functionality for setting manager relationships.
- **Calendar**: Three-view calendar (List, Weekly, Monthly) sourcing from events, tasks, and cron jobs.
- **Help Center Extended**: Topics on "Agent Memory System" and "Power Commands".
- **Task Dispatch**: Hub dispatches tasks to specific nodes with lifecycle tracking.
- **Cross-Machine Agent Routing**: Automatic cross-node dispatch for @mentioned agents.
- **Fleet-Wide Search**: Fan-out search to all online nodes and Hub memory.
- **Fleet Analytics**: Aggregated cost/usage analytics across Hub and nodes.
- **Node-to-Node Messaging**: Hub-relayed inter-node messaging.
- **Node Dispatch Worker**: Polls Hub for pending dispatches, executes locally, reports results.
- **Node Local Search**: Searches across agent memory, filesystem, and session history.
- **Node Self-Update System**: Automated update mechanism with backup, rollback, and state persistence.

## External Dependencies
- **LLM Providers**: OpenAI, Anthropic, Google Gemini, Mistral, Groq, Ollama.
- **Database**: PostgreSQL (`pgvector`), SQLite (`better-sqlite3`).
- **Real-time Communication**: PostgreSQL LISTEN/NOTIFY.
- **Email Service**: Resend.
- **Messaging Platforms**: Twilio (WhatsApp), Telegram Bot API, Slack (webhooks).
- **Authentication**: `bcryptjs`.
- **SSH Connectivity**: `ssh2`.
- **File Uploads**: Multer.
- **Payment Processing**: Stripe.
- **Code Editor**: `@monaco-editor/react`.