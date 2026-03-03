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
- All other routes (`/agents`, `/kanban`, `/settings`, etc.) — protected, inside Layout shell

## Recent Changes (Phase 9 — Landing + Subscription)
- **Public Landing Page**: `LandingPage.tsx` at `/` for unauthenticated users; purple (#7C3AED) + brown (#92400E) + offwhite (#FFF8F0) + yellow (#F59E0B) color palette; hero, how-it-works, squad preview, single $99/mo pricing card, BYOK explanation, login/signup CTAs; fully responsive with mobile nav
- **Subscription Page Redesign**: Current plan section with Crown icon + status badge + renewal date; 3 plan cards (Starter/Professional/Enterprise) with unique color themes (blue/purple/gold); upgrade/downgrade buttons; feature checklists with green checks; BYOK info section; all dark-themed with rgba() colors
- **Routing Update**: `HomeRedirect` component at `/` checks auth state — shows LandingPage if not logged in, redirects to `/dashboard` if logged in; Dashboard moved to `/dashboard` route; all nav links (Dock, Login, Register, Subscription back-link) updated to use `/dashboard`
- **Dark Theme Cleanup**: All remaining light-theme class remnants (bg-white, bg-gray-*, bg-slate-*, border-border-default, bg-surface-light) replaced across every page and component with CSS var equivalents; legacy Tailwind class overrides in index.css as safety net