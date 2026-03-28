# SquidJob — Complete Testing & Usage Guide

> **Purpose:** End-to-end walkthrough for setting up, using, and testing the entire SquidJob platform — Hub, Node apps, and Chrome extension — starting from a brand-new company account. Use the **✅ Test** checkpoints to verify each stage works correctly.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Roles & Permissions](#3-roles--permissions)
4. [SaaS Admin Console](#4-saas-admin-console)
5. [Tenant Onboarding (Hub Setup Wizard)](#5-tenant-onboarding-hub-setup-wizard)
6. [Hub Configuration — Agents, Team & Board](#6-hub-configuration--agents-team--board)
7. [Downloading the Node App & Chrome Extension](#7-downloading-the-node-app--chrome-extension)
8. [Node App Setup — First Run](#8-node-app-setup--first-run)
9. [Node App Daily Usage](#9-node-app-daily-usage)
10. [Agent Management via Node](#10-agent-management-via-node)
11. [Chrome Extension Setup](#11-chrome-extension-setup)
12. [Fleet Management (Hub)](#12-fleet-management-hub)
13. [Daily Workflows](#13-daily-workflows)
14. [Node App Updates](#14-node-app-updates)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────┐
│           SquidJob Hub              │
│   (Render.com — cloud hosted)       │
│   React/Vite + Express/PostgreSQL   │
│   Port 3001 (server) / 5000 (dev)   │
└────────────┬────────────────────────┘
             │  HTTPS + JWT
      ┌──────┴──────────────────┐
      │                         │
┌─────▼───────┐         ┌───────▼──────┐
│  Node App   │         │  Node App    │
│ (Machine A) │         │ (Machine B)  │
│ Next.js     │         │ Next.js      │
│ Port 3200   │         │ Port 3200    │
│ SQLite DB   │         │ SQLite DB    │
└──────┬──────┘         └──────┬───────┘
       │                       │
  OpenClaw                OpenClaw
  (AI Agents)             (AI Agents)
  ~/.openclaw             ~/.openclaw
```

**Key points:**
- The **Hub** is the central dashboard and data store — one instance for all tenants
- Each **Node app** runs on a physical machine alongside OpenClaw, reporting telemetry back to Hub
- The **Chrome extension** is a lightweight status overlay — it reads from Hub via API key
- All data flows from machines → Node → Hub; commands flow from Hub → Node → OpenClaw

---

## 2. Prerequisites

| Item | Required? | Notes |
|------|-----------|-------|
| Node.js 18+ | Yes | For running the Node app locally |
| npm | Yes | Installed with Node.js |
| OpenClaw | Yes (for agents) | Must be installed before Node app is useful |
| Chrome/Chromium browser | Yes (for extension) | Extension uses Manifest V3 |
| Hub URL | Yes | e.g. `https://yourapp.onrender.com` |
| Admin credentials | Yes | Set during SaaS admin console setup |

---

## 3. Roles & Permissions

Four roles exist within each tenant. A separate `is_saas_admin` flag grants SaaS-level access.

| Feature / Action | Owner | Admin | Operator | Viewer |
|-----------------|-------|-------|----------|--------|
| Create / delete agents | ✅ | ✅ | ❌ | ❌ |
| Edit agent config (SOUL, model) | ✅ | ✅ | ❌ | ❌ |
| Create / edit tasks | ✅ | ✅ | ✅ | ❌ |
| View tasks and board | ✅ | ✅ | ✅ | ✅ |
| Invite team members | ✅ | ✅ | ❌ | ❌ |
| Change member roles | ✅ | ❌ | ❌ | ❌ |
| Register / delete fleet nodes | ✅ | ✅ | ❌ | ❌ |
| View fleet and analytics | ✅ | ✅ | ✅ | ✅ |
| Generate API tokens | ✅ | ✅ | ❌ | ❌ |
| Manage billing / subscription | ✅ | ❌ | ❌ | ❌ |
| Access SaaS Admin console | SaaS Admin flag only ||||

**Plans:** `starter` · `professional` · `enterprise` — control feature limits, not role access.

---

## 4. SaaS Admin Console

The SaaS Admin console manages the entire platform — all tenants, plans, and billing. It is separate from the regular tenant UI.

### 4.1 Accessing the Admin Console

1. Navigate to `https://your-hub-url/admin`
2. Log in with your SaaS admin credentials (user with `is_saas_admin = true`)
3. You land on the **Admin Dashboard** showing MRR, ARR, plan counts, and active/trial/suspended tenant counts

> **If/else:** Regular tenant users who try `/admin` are redirected to `/login` — the route is protected by `is_saas_admin` check.

### 4.2 Creating a New Tenant (Company)

1. Go to **Admin → Tenants**
2. Click **"New Tenant"** in the top-right
3. Fill in:
   - **Company Name** — displayed throughout the UI
   - **Admin Email** — the first owner account for this tenant
   - **Password** — temporary password for the owner (they should change it)
   - **Plan** — `starter`, `professional`, or `enterprise`
   - **Subdomain** *(optional)* — for white-labelling
4. Click **Create Tenant**

The system creates:
- A new tenant row in the database
- An owner-role user with the provided email/password
- A set of default agents seeded for the tenant

> **✅ Test:** After creation, verify the tenant appears in the Tenants list with status "Active", correct plan badge, and 0 tasks. Click the tenant row to see the detail view.

### 4.3 Managing Existing Tenants

From the Tenants list you can:
- **Change plan** — click the plan badge to switch starter/professional/enterprise
- **Suspend / Activate** — toggle the tenant's status (suspended users can't log in)
- **Delete** — permanently removes tenant and all data (confirmation required)
- **View detail** — see all users, agent count, task count, and last active timestamp

> **✅ Test:** Suspend a test tenant, then try logging in as that tenant's owner — confirm you're blocked. Reactivate and verify login works again.

---

## 5. Tenant Onboarding (Hub Setup Wizard)

The first time a tenant owner logs in, they see the **Setup Wizard**. It guides them through 8 steps.

### 5.1 The 8 Steps

| Step | Label | Required | What It Does |
|------|-------|----------|-------------|
| 1 | Welcome 👋 | Yes | Overview of SquidJob — no input required |
| 2 | LLM Provider 🧠 | Yes | Enter API key for OpenAI / Anthropic / Gemini / Groq / Mistral (BYOK) |
| 3 | Telegram 💬 | Optional | Connect Telegram bot for agent notifications |
| 4 | WhatsApp 📱 | Optional | Connect Twilio WhatsApp number |
| 5 | Discord 🎮 | Optional | Connect Discord webhook |
| 6 | First Agent 🤖 | Optional | Create your first agent using the Builder |
| 7 | Register Node 🖥️ | Optional | Register a machine node (generates credentials) |
| 8 | Launch 🚀 | Yes | Marks setup complete, redirects to Dashboard |

Optional steps can be skipped with the **"Skip for now"** button and completed later from Settings.

### 5.2 LLM Provider (Step 2) — Critical Path

- Enter your API key for the chosen provider
- The wizard validates the key before proceeding
- **If/else:** If you enter an invalid key, you'll see a red error and cannot advance — re-enter a valid key or choose a different provider

> **✅ Test:** Enter a deliberately wrong API key — confirm validation error appears. Enter a correct key — confirm green indicator and "Next" becomes active.

### 5.3 Messaging Setup (Steps 3–5)

- All three are optional — skip all if messaging is not needed
- **Telegram:** Requires a bot token from @BotFather + a chat ID
- **WhatsApp:** Requires Twilio Account SID, Auth Token, and WhatsApp number
- **Discord:** Requires a webhook URL from a Discord channel

> **✅ Test:** Skip all three messaging steps. Verify the wizard still advances to Step 6.

### 5.4 First Agent (Step 6)

- Give your agent a name, choose a model, and optionally write a brief role description
- The SoulCraft wizard generates the `SOUL.md` personality file
- **If/else:** If you skip this step, a default "Assistant" agent is still available from the Agents page

### 5.5 Launch (Step 8)

- Review a summary of what was configured
- Click **"Launch Mission Control"** — this marks `setup_completed = true` in tenant settings and redirects to the main Dashboard

> **✅ Test:** Complete all steps including Launch. Verify you land on the Dashboard, the setup wizard no longer appears on refresh, and the top navigation is fully visible.

---

## 6. Hub Configuration — Agents, Team & Board

### 6.1 Creating Agents

**From:** Hub → **Agents** → **New Agent**

1. Enter agent name, role description, and select an LLM model
2. Use the **SoulCraft Wizard** to define personality, tone, and capabilities via guided prompts — the wizard generates a `SOUL.md` file
3. Assign skills from the Marketplace (optional)
4. Click **Create Agent**

> **✅ Test:** Create two agents — one with the SoulCraft wizard and one without. Verify both appear on the Agents page with correct model and status badges.

### 6.2 Inviting Team Members

**From:** Hub → **Organisation** → **Invite**

1. Enter email address and select a role (admin / operator / viewer)
2. They receive a registration link
3. Once registered, they appear in the org chart

> **✅ Test:** Invite a viewer-role user. Log in as that user and confirm they can see tasks and agents but cannot create or edit anything.

### 6.3 Board (Kanban) Usage

**From:** Hub → **Board**

- Columns: Backlog → In Progress → Review → Done
- Drag tasks between columns to update status
- Use **Board Groups** to organise tasks by project or team
- Click any task card to open the detail panel (comments, assignee, due date, attachments)

> **✅ Test:** Create a task from the Board, drag it through all columns, and verify status updates are reflected on the Activity feed.

### 6.4 API Tokens

**From:** Hub → **Settings** → **API Tokens**

- Create named tokens for programmatic access
- Tokens are shown only once on creation — copy immediately
- Used by nodes, extensions, and external integrations

---

## 7. Downloading the Node App & Chrome Extension

Both downloads are available from a single location in the Hub.

### 7.1 Download Location

**Hub → Settings → Downloads tab**

You will see two download buttons:

| Download | Button Label | File | Endpoint |
|----------|-------------|------|----------|
| Node App | "Download Node App" | `squidjob-node.zip` | `GET /v1/downloads/node` |
| Chrome Extension | "Download Extension" | `squidjob-extension.zip` | `GET /v1/downloads/extension` |

> **Important:** You must be logged into the Hub to download — both endpoints require authentication.

> **✅ Test:** Click both download buttons while logged in. Verify `.zip` files download successfully. Log out and try again — confirm you are redirected to login.

---

## 8. Node App Setup — First Run

The Node app runs on each machine alongside OpenClaw, giving you a local dashboard at `http://localhost:3200`.

### 8.1 Installation

```bash
# 1. Unzip the downloaded package
unzip squidjob-node.zip
cd squidjob-node

# 2. Install dependencies
npm install

# 3. Copy the example env file
cp .env.example .env
```

### 8.2 First-Run Setup Wizard

The first time you run `npm run dev`, the app detects that setup is incomplete and redirects to `http://localhost:3200/setup`. The wizard has **7 steps**:

| Step | Label | Required | What It Does |
|------|-------|----------|-------------|
| 1 | Welcome | No | Introduction — no input needed |
| 2 | Hub Connection | **Yes** | Enter Hub URL + API key + Node ID |
| 3 | Admin Password | **Yes** | Set a local admin password (default is `admin` — must change) |
| 4 | Node Identity | **Yes** | Set a friendly name for this machine |
| 5 | LLM API | No | Enter LLM API key for local agent operations |
| 6 | Messaging | No | Telegram/WhatsApp token for notifications |
| 7 | Launch | No | Completes setup and opens the dashboard |

### 8.3 Getting Hub Connection Credentials

Before Step 2, you need to register the node on the Hub:

1. Log in to Hub → **Fleet** → click **"Register Node"**
2. Enter a name for this machine (e.g. "Mac Studio — Studio")
3. The Hub generates:
   - **Node ID** (`NODE_ID`) — a UUID
   - **API Key** (`NODE_HUB_API_KEY`) — starts with `sqn_`
4. Copy both values into the Node wizard (or into your `.env` file directly)

### 8.4 Manual .env Configuration

If you prefer to skip the wizard and configure directly:

```env
# Hub connection (from Hub → Fleet → Register Node)
NODE_HUB_URL=https://your-hub.onrender.com
NODE_HUB_API_KEY=sqn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NODE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Node identity
NODE_NAME=My Mac Studio

# OpenClaw location (default: ~/.openclaw)
OPENCLAW_DIR=/Users/yourname/.openclaw

# Node app auth (change this!)
ADMIN_PASSWORD=changeme
```

Then restart the app: `npm run dev`

### 8.5 Accessing the Node App

| URL | Description |
|-----|-------------|
| `http://localhost:3200` | Main dashboard |
| `http://localhost:3200/setup` | Setup wizard (only shown if not yet configured) |
| `http://localhost:3200/api/health` | Health check JSON |

> **If/else — Hub connected vs standalone:**
> - **Hub configured:** Heartbeats sent every 60 seconds; telemetry (sessions, costs, activity) synced every 5 minutes to Hub
> - **Standalone mode:** All data stays local; Hub Fleet page shows node as "Never connected"

> **✅ Test:** After setup, open `http://localhost:3200/api/health`. Verify `status: "ok"`, correct version, and `openclaw.configured: true` if OpenClaw is installed.

---

## 9. Node App Daily Usage

### 9.1 Dashboard

Shows system metrics (CPU, RAM, disk) refreshed every 30 seconds, plus a summary of agents, recent sessions, and today's costs.

### 9.2 Pages Reference

| Page | URL | What it shows |
|------|-----|--------------|
| Dashboard | `/` | System stats, agent summary, cost today |
| Agents | `/agents` | All discovered OpenClaw agents with status |
| System | `/system` | Detailed CPU/RAM/disk/network stats |
| Sessions | `/sessions` | Session history with token counts and model |
| Costs | `/costs` | Per-agent cost breakdown with daily trends |
| Cron | `/cron` | Scheduled OpenClaw jobs — enable/disable/run now |
| Files | `/files` | File browser with Monaco editor |
| Memory | `/memory` | Agent memory files (SOUL.md, TOOLS.md, etc.) |
| Terminal | `/terminal` | Shell access to the machine |
| Activity | `/activity` | Event timeline for all agent actions |
| Settings | `/settings` | Hub connection status, update system |

---

## 10. Agent Management via Node

### 10.1 How Agents Are Discovered

The Node app reads agents from the OpenClaw configuration:

1. **Primary:** Reads `~/.openclaw/openclaw.json` → `agents.list` array
2. **Fallback:** Scans `~/.openclaw/workspace-*/` directories for agent workspace folders

Each discovered agent has:
- An ID (from config or folder name)
- A status: `active` (heartbeat < 5 min) · `idle` · `unknown`
- A model (from config or defaults)

### 10.2 Adding a New Agent

Agents are managed by OpenClaw, not directly by the Node app. To add a new agent:

1. **Via OpenClaw config** — Add an entry to `~/.openclaw/openclaw.json` under `agents.list`:
   ```json
   {
     "agents": {
       "list": [
         { "id": "researcher", "model": { "primary": "claude-opus-4-5" } },
         { "id": "writer",     "model": { "primary": "gpt-4o" } }
       ]
     }
   }
   ```
2. The Node app will discover the new agent on its next scan (within 30 seconds)
3. The agent appears in **Node → Agents** with status "unknown" until it runs a session

> **If/else:**
> - **`openclaw.json` has `agents.list`:** Node uses this as the source of truth
> - **No `agents.list`:** Node scans `workspace-*/` directories as fallback — any folder with a `SOUL.md` file becomes an agent

### 10.3 Importing Existing Agents

If agents were created on another machine or migrated from a previous installation:

1. Copy the agent workspace folders to `~/.openclaw/workspace-<agentid>/`
2. Ensure each folder contains at minimum a `SOUL.md` file
3. Optionally, register the agents in `openclaw.json` for explicit control
4. Restart OpenClaw — the Node app will pick them up automatically

### 10.4 Editing Agent Memory (SOUL.md, TOOLS.md)

**From Node → Memory**

1. Select an agent from the dropdown
2. Browse the memory files: `SOUL.md` (personality), `TOOLS.md` (capabilities), `memory.md` (context), `identity.md` (identity card)
3. Click any file to open it in the Monaco code editor
4. Edit and save — changes take effect on the agent's next session

> **⚠️ Caution:** SOUL.md changes affect the agent's core behaviour immediately. Test with a non-critical agent first.

> **✅ Test:** Open an agent's SOUL.md, add a test comment line, save, and verify the change persists by reopening the file.

### 10.5 Agent Status Meanings

| Status | Meaning | Action |
|--------|---------|--------|
| Active | Heartbeat received in last 5 minutes | — |
| Idle | No recent heartbeat but workspace exists | Check if OpenClaw is running |
| Unknown | No heartbeat data at all | Agent may not have run yet |

---

## 11. Chrome Extension Setup

The **SquidJob Fleet Monitor** extension shows node statuses, agent counts, and alerts from your browser toolbar.

### 11.1 Download

**Hub → Settings → Downloads → "Download Extension"**

This downloads `squidjob-extension.zip`. Save it somewhere permanent — you'll need the folder path during install.

### 11.2 Installation (Developer Mode)

Since the extension is not published to the Chrome Web Store, it must be loaded manually:

1. Open Chrome and navigate to `chrome://extensions`
2. Toggle **Developer mode** (top-right corner) to **ON**
3. Click **"Load unpacked"**
4. Select the **unzipped** extension folder (not the zip — unzip it first!)
5. The extension icon appears in your toolbar

> **If/else:**
> - **Extension icon visible:** Installation succeeded — click to open the popup
> - **Error: "Manifest file is missing or unreadable"** — You selected the zip file instead of the unzipped folder. Unzip and try again
> - **Icon greyed out:** Extension is disabled — click the puzzle icon and pin/enable it

### 11.3 Configuring the Extension

1. Right-click the extension icon → **"Options"** (or find it via `chrome://extensions`)
2. Enter:
   - **Hub URL** — `https://your-hub.onrender.com` (no trailing slash)
   - **API Key** — your Hub API token (from Hub → Settings → API Tokens)
3. Save — the extension starts polling immediately

### 11.4 What the Extension Shows

**Popup (click toolbar icon):**
- Total nodes in fleet (online / degraded / offline counts)
- Agent count per online node
- CPU and memory averages
- Last sync timestamp

**Badge (on the toolbar icon):**
- Number of offline or degraded nodes (if any)
- No badge = all nodes healthy

**Notifications:**
- Node goes offline: browser notification
- Node recovers: notification cleared

> **✅ Test:** With the extension configured, take a Node app offline (stop `npm run dev`). Within 2 minutes, verify the badge count increments and a notification appears.

---

## 12. Fleet Management (Hub)

### 12.1 Registering a Node

**Hub → Fleet → "Register Node"**

1. Enter a descriptive name for the machine
2. Click Register
3. **Copy the credentials immediately** — the API key is shown only once:
   - `NODE_ID`
   - `NODE_HUB_API_KEY`
4. Paste these into the Node app setup wizard or your `.env` file

> **✅ Test:** Register a node, then configure the Node app with the credentials. Within 2 minutes, the Fleet page should show the node as "Online" with CPU/RAM metrics.

### 12.2 Fleet Dashboard

Shows all registered nodes with:
- Status indicator: 🟢 Online · 🟡 Degraded · 🔴 Offline
- CPU / RAM / Disk percentages from the last heartbeat
- Agent count
- Last heartbeat timestamp
- Click any node row to expand the detail panel (full system info, agent list, recent dispatches)

**Node status logic:**
| Condition | Status |
|-----------|--------|
| Heartbeat received < 2 minutes ago | Online |
| Heartbeat received 2–10 minutes ago | Degraded |
| Heartbeat received > 10 minutes ago, or never | Offline |

### 12.3 Removing a Node (Soft Delete)

**Fleet → node row → Delete button**

1. Click the delete button on a node card
2. A confirmation modal appears — type the node name to confirm
3. Optionally enter a reason for deletion
4. Click **"Delete Node"**

The node is **soft-deleted** (not permanently removed):
- It disappears from the fleet immediately
- A record is kept in `deleted_nodes_history` for **30 days**
- Within 30 days, an admin can restore it via the database or an API call

> **If/else:**
> - **Node is online when deleted:** The node app continues running — it will fail heartbeat authentication on next sync and log an error locally
> - **Node is offline when deleted:** No immediate effect — the credentials simply stop working

> **✅ Test:** Delete a test node. Verify it no longer appears in the Fleet list. Check that the Node app logs a heartbeat 401 error on its next sync attempt.

### 12.4 Task Dispatch to Nodes

From the Board, assign a task to a specific node by setting the **Target Node** field. The Hub dispatches the task and tracks the lifecycle: `dispatched → running → completed / failed`.

### 12.5 Fleet Analytics

**Hub → Fleet Analytics**

- Aggregated cost and usage data across all nodes
- Filter by date range, model, or individual agent
- Per-node cost comparison chart

---

## 13. Daily Workflows

### 13.1 Standard Operations Loop

```
Morning:
1. Check Hub Dashboard — review overnight agent activity
2. Check Fleet page — verify all nodes are Online
3. Review Board — move any stuck tasks, check for failed dispatches

During the day:
4. Create tasks on the Board — assign to agents via Target Node
5. Monitor Sessions on Node apps — track token usage
6. Review Costs page — check daily spend by agent

End of day:
7. Review Activity Timeline on Hub — full event log
8. Check Memory pages — review agent context if needed
```

### 13.2 Creating and Dispatching a Task

1. Hub → **Board** → click **"+ New Task"**
2. Enter title, description, priority, and assign an agent
3. Set **Target Node** to the machine where the agent runs
4. Move to **In Progress** column or Hub will auto-dispatch

### 13.3 Fleet-Wide Search

**Hub → Search** (`/search`)

- Searches across Hub board memory AND all connected Node agents' memory simultaneously
- Results ranked by relevance using hybrid BM25 + vector search
- Useful for finding past decisions, agent notes, or memory entries

---

## 14. Node App Updates

### 14.1 Checking for Updates

**Node → Settings → Software Update section**

1. Click **"Check for Updates"** — requires Hub connection
2. The Node app queries `GET /v1/version` on your Hub
3. If a newer version is available, an **"Install Update"** button appears

> **If/else:**
> - **Hub connected:** Version check is automatic via the Hub endpoint
> - **No Hub connection:** Enter a direct download URL in the "Custom Download URL" field

### 14.2 Update Process (Automatic)

When you click **"Install Update"**, the following steps run automatically — progress is shown in the log panel:

| Step | What happens |
|------|-------------|
| 1. Backup | SQLite database copied to `~/.openclaw/backups/squidjob-node.db.TIMESTAMP.bak` |
| 2. Pause services | Hub heartbeat and telemetry sync are suspended |
| 3. Download | New zip downloaded from Hub |
| 4. Install | Files extracted — `.env` and `squidjob-node.db` are **never overwritten** |
| 5. npm install | Dependencies updated |
| 6. Resume services | Heartbeat and sync restart |
| Done | "Restart required" message shown |

After a successful update, restart the Node app:
```bash
npm run dev
# or: pm2 restart squidjob-node
```

### 14.3 Manual Update (Shell Script)

For headless servers or automation:

```bash
# From the squidjob-node root directory
bash scripts/squidjob-update.sh

# Or with a custom download URL
bash scripts/squidjob-update.sh https://your-hub.onrender.com/v1/downloads/node
```

The script reads `NODE_HUB_URL` from your `.env` automatically.

### 14.4 Rollback

If the update causes issues:

**From UI:** Node → Settings → Software Update → **"Rollback Database"**

**From terminal:**
```bash
# Find the most recent backup
ls -t ~/.openclaw/backups/*.bak | head -1

# Restore manually
cp ~/.openclaw/backups/squidjob-node.db.TIMESTAMP.bak ~/.openclaw/squidjob-node.db
```

> **What rollback covers:**
> - ✅ Database (sessions, costs, activity, sync state) is restored
> - ❌ Code files are NOT reverted — re-download the previous version zip if needed
> - Backups are kept for the last 5 updates then auto-cleaned

> **✅ Test:** Run an update, note the backup filename shown in the log, then immediately click Rollback. Verify the node app still works and the log confirms "Database restored from: ..."

---

## 15. Troubleshooting

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Node shows "Offline" on Fleet | Node app not running or no internet | Start `npm run dev`; check `.env` `NODE_HUB_URL` |
| Node shows "Degraded" | Heartbeat delayed > 2 min | Wait for next cycle (60s) or restart Node app |
| Heartbeat failing with 401 | Invalid `NODE_HUB_API_KEY` or node was deleted | Re-register node on Hub Fleet page; update `.env` |
| No agents on Node → Agents page | OpenClaw not installed or wrong `OPENCLAW_DIR` | Install OpenClaw; verify `OPENCLAW_DIR` in `.env` |
| Setup wizard loops (won't complete) | `ADMIN_PASSWORD` still set to `admin` | Change to any other value in `.env` |
| Hub URL changed, heartbeats failing | Old `NODE_HUB_URL` in `.env` | Update `NODE_HUB_URL` in Node app `.env`, restart |
| Extension shows no data | Wrong Hub URL or expired API token | Re-check options page; regenerate API token in Hub |
| Update stuck "downloading" | Hub unreachable or slow connection | Check Hub status; use Custom URL with direct link |
| Update failed, services paused | Error mid-update | Services auto-resume on failure; click "Clear Error" then retry |
| Can't log into Hub after merge | Password hash mismatch | Use Admin Console to reset password |
| Chrome extension "Manifest missing" | Loaded zip file instead of folder | Unzip first, then Load Unpacked the folder |

### Useful URLs Quick Reference

| What | URL |
|------|-----|
| Hub (production) | `https://your-hub.onrender.com` |
| Hub admin console | `https://your-hub.onrender.com/admin` |
| Hub fleet page | `https://your-hub.onrender.com/fleet` |
| Node app local | `http://localhost:3200` |
| Node health check | `http://localhost:3200/api/health` |
| Node setup wizard | `http://localhost:3200/setup` |
| Hub version endpoint | `https://your-hub.onrender.com/v1/version` |
| Download Node app | Hub → Settings → Downloads |
| Download Extension | Hub → Settings → Downloads |

---

*Last updated: March 2026 · SquidJob v0.1.0*
