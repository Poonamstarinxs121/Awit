# AWIT Documentation

**Awit Media Private Limited** · **SquidJob.com**

## Documents in this folder

- **[Awit Architecture Draft.md](Awit%20Architecture%20Draft.md)** — Product specification and technical blueprint for SquidJob.com (~756 lines).
- **[Architecture-NodeJS-PostgreSQL.md](Architecture-NodeJS-PostgreSQL.md)** — Detailed development architecture for building the application with Node.js and PostgreSQL.
- **[OpenClaw-Deep-Dive-and-SquidJob-Build-Plan.md](OpenClaw-Deep-Dive-and-SquidJob-Build-Plan.md)** — How OpenClaw works, how its agents work, and how SquidJob.com’s build plan maps to it (adopt vs change for multi-tenant SaaS).
- **[Critical-Pages-and-Features.md](Critical-Pages-and-Features.md)** — Critical application pages and features per page; detailed structure for Landing, Registration, Package selection, Support, and Knowledge base.

---

## Document summary: *Awit Architecture Draft.md*

The file is the main spec for **SquidJob.com**: a multi-tenant SaaS platform that orchestrates independent AI agents into coordinated teams (BYOK, Mission Control UI, shared DB, agent management). It references OpenClaw, Bhanu Teja P's Mission Control, and QMD-style hybrid search.

**High-level sections:**

1. **System architecture** — Hub-and-spoke: Agent Orchestration Engine, BYOK Gateway, Session & Memory Layer, Mission Control UI, Multi-Tenant Infrastructure.
2. **Multi-tenant infrastructure** — Tiers (Starter / Professional / Enterprise), isolation (shared schema+RLS → schema-per-tenant → dedicated instance), tenant context propagation.
3. **Agent orchestration engine** — Session Manager, Router, Cron Scheduler; agent execution lifecycle.
4. **Session management** — Session key structure, state model, tiered persistence (Redis / DB / object storage), auto-compaction (memory flush, summarization, context rebuild).
5. **Memory and context** — Four-tier stack (SOUL, MEMORY, WORKING, daily notes); QMD-inspired hybrid retrieval (query expansion, BM25+vector, RRF, reranking); context budget allocation.
6. **Communication** — @mentions, thread subscriptions, activity feed, inter-agent messaging.
7. **Mission Control UI** — Dashboard, Kanban, Agent Roster, Standup View; React SPA + Convex, real-time subscriptions.
8. **Task management** — Lifecycle (Inbox → Assigned → In Progress → Review → Done), task/comment/activity data model.
9. **Security** — BYOK/key vault, agent sandboxing (Docker → gVisor → Firecracker), RBAC, audit/compliance.
10. **Heartbeat and scheduling** — Heartbeats, staggered scheduling, cron jobs (DB-stored, main-session vs isolated).
11. **Daily standups** — Cron-triggered aggregation, per-agent and squad-level synthesis.
12. **Sub-agents** — Default 10-agent roster, SOUL/AGENTS/TOOLS configuration.
13. **Further sections** — Delivery roadmap, API surface, and remaining technical details (document continues past line ~350).

**Recent planning additions:**

- **Blocked** is modeled as a **flag + metadata** (badge/filters/standups), while keeping the 5-column Kanban workflow.
- **Telegram integration (MVP)** is included for notifications and safe quick commands alongside the Mission Control web app.
---

## Conclusion

This workspace centers on the SquidJob.com product and architecture. All manuals and architecture documents live in this `docs/` folder.
