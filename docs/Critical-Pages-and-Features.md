# SquidJob.com: Critical pages and features

**Awit Media Private Limited** · **SquidJob.com**

This document lists the critical application pages, the features users get on each page, and detailed structure for the main public and funnel pages (Landing, Registration, Package selection, Support, Knowledge base).

---

## 1. Critical pages and features (app and auth)

All Mission Control and settings pages are behind login. Tenant context and role-based access (Owner, Admin, Operator, Viewer) apply.

| Page / View | Purpose | Features users get |
|-------------|--------|---------------------|
| **Mission Control Dashboard (home)** | At-a-glance overview | Agent roster summary with status (active/idle/error); task pipeline summary (counts per column: Inbox, Assigned, In Progress, Review, Done); today's metrics (tasks completed, tokens consumed, cost); live activity feed; header with context filter, agent count, task count, online status, time; tenant owner label (e.g. **Kaustubh - Founder**). |
| **Mission Queue (Kanban)** | Task workflow | Five columns: Inbox, Assigned, In Progress, Review, Done; task cards (title, description, assignee e.g. **Oracle (Squad Lead)**, agents, time, tags); **Blocked badge** (flag, not a workflow stage) with filters (Blocked-only; blocked by me/others); drag-and-drop reassignment; create task; click card to open Task Detail Panel. |
| **Task Detail Panel** | Single-task view | Full description; comment thread with @mentions; deliverables; activity history; change status; assign/reassign; **blocked metadata** (reason, owner, since, optional unblock-by); add comment. |
| **Agents Panel / Agent Roster** | Who is in the squad | List of agents with name (e.g. **Oracle (Squad Lead)**, Scout, Scribe), role/specialization, status (e.g. WORKING), icon; link to each agent's configuration page. |
| **Agent Configuration** | Edit one agent | View/edit SOUL (personality); view/edit AGENTS.md, TOOLS.md, HEARTBEAT.md; model selection; capability/tools; heartbeat interval; routing rules; view memory contents; view session transcripts. |
| **Agent Builder** | Create custom agent | Identity (name, avatar, role); SOUL editor (SoulCraft wizard); capability assignment; model selection; heartbeat config; routing rules. |
| **Live Feed** | Real-time activity | Filterable stream (Tasks, Comments, Decisions, etc.); filter by agent; entries show agent action + task reference + timestamp; real-time updates via WebSocket. |
| **Standup View** | Daily accountability | Today's standup: per-agent completed work, in-progress items, blockers, priorities; squad-level narrative; historical standups archived and searchable; optional delivery (email, Slack, webhooks). |
| **Configuration / Settings** | Tenant and API keys | Connect BYOK providers (e.g. OpenAI, Anthropic); disconnect provider; view usage/cost; tenant settings (timezone, heartbeat interval); webhooks; **Integrations: Telegram connect/disconnect + notification/command toggles**; RBAC (invite users, roles). |
| **Authentication / Login** | Access | Sign in (e.g. OAuth/email); sign out; tenant context; role-based access (Owner, Admin, Operator, Viewer). |

---

## 2. Detailed structure: Landing page

**Purpose:** Public marketing and conversion; explain SquidJob.com and drive sign-up.

**Structure (sections and components):**

- **Header:** Logo (SquidJob.com / Awit Media); primary nav (Product, Pricing, Knowledge base, Support, Login, Get started / Sign up); mobile menu.
- **Hero:** Headline and subhead (e.g. multi-agent squad, BYOK, Mission Control); primary CTA (Start free trial / Get started); secondary CTA (Watch demo / See how it works); optional hero visual (dashboard mockup or illustration).
- **Social proof:** Logos, testimonials, or "X agents active / Y tasks completed" style metrics.
- **Product overview:** Short blocks for value props (e.g. 10-agent squad, Kanban, standups, BYOK, security); optional screenshots or short product tour.
- **How it works:** 3–4 steps (e.g. Sign up → Connect API keys → Deploy squad → Mission Control); each step with icon, title, one-line description.
- **Pricing teaser:** "Plans for every team" with link to Pricing / Package selection (no full pricing table required on landing).
- **FAQ (compact):** 3–5 common questions (e.g. What is BYOK? How many agents?).
- **Footer:** Links (Product, Pricing, Docs, Knowledge base, Support, Contact, Privacy, Terms); company (Awit Media Private Limited); optional newsletter signup.
- **Footer CTA:** Repeat primary CTA (Get started).

**User flows:** Anonymous visitor → scroll/read → click Get started / Sign up → Registration or Login.

---

## 3. Detailed structure: Registration page

**Purpose:** Create a new tenant account and first user (e.g. Owner).

**Structure (sections and components):**

- **Header:** Logo; link back to Landing or Login.
- **Form container:** Centered card or panel.
- **Registration form fields:** Email (required); Password (required, strength indicator, confirm password); Full name (required); Company / Tenant name (required, used as default tenant name); Optional: Phone, referral/promo code.
- **Terms and consent:** Checkbox "I agree to Terms of Service and Privacy Policy" (required); optional marketing consent checkbox.
- **Submit:** Primary button "Create account" or "Get started"; loading state; client-side validation before submit.
- **Post-submit:** Success state (e.g. "Check your email to verify") or redirect to email verification / onboarding (e.g. Package selection or first-login wizard).
- **Onboarding (post first-login):** Select package → connect BYOK provider keys → **connect Telegram (optional but recommended)** → launch Mission Control.
- **Footer link:** "Already have an account? Log in" → Login page.

**User flows:** Visitor from Landing/CTA → fill form → submit → email verification (if used) → redirect to Package selection or Dashboard.

---

## 4. Detailed structure: Package selection (Pricing / Plan selection) page

**Purpose:** Choose a plan (Starter, Professional, Enterprise) before or after registration; can be part of onboarding or a dedicated Pricing page.

**Structure (sections and components):**

- **Header:** Logo; nav (e.g. back to Product, Login for existing users).
- **Page title and context:** "Choose your plan" or "Pricing"; short line (e.g. Start free, scale as you grow).
- **Plan cards (3 tiers):**
  - **Starter:** Name, price (e.g. $X/month or Free trial); short feature list (e.g. 5 agents, shared schema + RLS, 1 GB storage, community support); CTA "Start free trial" or "Get started".
  - **Professional:** Name, price; feature list (e.g. 20 agents, schema-per-tenant, gVisor, 10 GB, priority support); CTA "Start trial" or "Contact sales".
  - **Enterprise:** Name, "Custom" or "Contact us"; feature list (e.g. unlimited agents, dedicated DB, Firecracker, SLA, SSO); CTA "Contact sales" or "Schedule demo".
- **Comparison (optional):** Table or rows comparing limits (agents, storage, support, isolation) across plans.
- **FAQ (optional):** Billing, BYOK, upgrade/downgrade.
- **Footer:** Link to Support or Contact for questions.

**User flows:** New user post-registration → select plan → Start trial → checkout or redirect to Mission Control; existing user → Settings/Billing → change plan (same or linked page).

---

## 5. Detailed structure: Support page

**Purpose:** Central place to get help (tickets, status, contact).

**Structure (sections and components):**

- **Header:** Logo; nav (back to app, Knowledge base, Contact).
- **Page title:** "Support" or "Help & support".
- **Quick actions:**
  - **Submit a ticket:** Link or embedded form (subject, category, description, attachment); submit → confirmation and ticket ID.
  - **Check ticket status:** Link to "View my tickets" (auth required); list of user's tickets with status (Open, In progress, Resolved).
  - **Contact:** Email (e.g. support@squidjob.com), optional phone or "Schedule a call" for higher tiers.
- **Resources block:** Short links to Knowledge base, API docs, Status page (if any).
- **FAQ (short):** 3–5 support-related questions (e.g. response time, how to escalate).
- **Footer:** Same as Landing or app footer.

**User flows:** User with issue → Support page → submit ticket or open Knowledge base; return later → check ticket status.

---

## 6. Detailed structure: Knowledge base page(s)

**Purpose:** Self-serve docs and articles (how-to, concepts, troubleshooting).

**Structure (sections and components):**

- **Header:** Logo; search (full-text over articles); nav (e.g. Home, Getting started, Mission Control, Agents, Billing, API).
- **Sidebar (or top nav):** Categories/sections (e.g. Getting started, Mission Control UI, Agents & SOUL, Tasks & Kanban, Standups, BYOK & Security, Billing & plans, API & webhooks). Expandable sections with article list.
- **Content area:** Article title; breadcrumb (e.g. Knowledge base > Mission Control > Kanban); body (markdown-rendered); optional "Was this helpful?" (yes/no); related articles; last updated.
- **Search results view:** Query in header; list of matching articles with snippet and category; click → article.
- **Home (optional):** Knowledge base landing with "Popular articles" and "Getting started" links.

**User flows:** User needs help → Knowledge base (from Support or nav) → browse by category or search → read article; optional "Still stuck?" → link to Support (submit ticket).
