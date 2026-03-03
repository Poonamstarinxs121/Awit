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
SquidJob uses a **Hub + Node** architecture:
- **Hub** (this app): Central VPS with React/Vite + Express/PostgreSQL for fleet dashboard, 3D Office, and board memory.
- **Node** (per machine): Next.js app running alongside OpenClaw for agent discovery, system monitoring, and hub synchronization.

The codebase is a monorepo with `server/`, `client/`, and `node/` directories.

**Technology Stack:**
- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with `pgvector` extension
- **Authentication**: JWT, bcryptjs, RBAC (Owner/Admin/Operator/Viewer)
- **LLM Integration**: OpenAI SDK supporting OpenAI, Anthropic, Google Gemini, Mistral, Groq (BYOK), and Ollama (local LLM).
- **Real-time**: WebSocket layer using PostgreSQL LISTEN/NOTIFY.
- **Search**: pgvector + BM25 hybrid memory search with Reciprocal Rank Fusion.
- **File Storage**: Multer-based file uploads.

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
- **Approval Flows**: Implements approval workflows with pending/approved/rejected states and a dedicated UI.
- **Board Groups**: Organizes tasks into board groups with filtering capabilities in the Kanban view.
- **Activity Timeline**: Provides a comprehensive event timeline with filtering by event type and pagination.

## External Dependencies
- **LLM Providers**: OpenAI, Anthropic, Google Gemini, Mistral, Groq, Ollama.
- **Database**: PostgreSQL with `pgvector` extension.
- **Real-time Communication**: PostgreSQL LISTEN/NOTIFY.
- **Email Service**: Resend.
- **Messaging Platforms**: Twilio (for WhatsApp), Telegram Bot API, Slack (webhooks).
- **Authentication**: bcryptjs.
- **SSH Connectivity**: `ssh2` npm package.
- **File Uploads**: Multer.
- **Payment Processing**: Stripe.