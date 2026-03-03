# SquidJob Hub + Node Architecture

## Overview

SquidJob uses a Hub + Node architecture where:

- **Hub** (central VPS): React/Vite + Express/PostgreSQL — aggregates data from all connected nodes into a unified fleet dashboard
- **Node** (per machine): Next.js app — runs alongside OpenClaw, reads local filesystem, collects telemetry, pushes to Hub

```
┌─────────────────────────────────────────────────┐
│                  SquidJob Hub                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ React UI │  │ Express  │  │ PostgreSQL   │   │
│  │ (Vite)   │  │ API      │  │ + pgvector   │   │
│  └──────────┘  └──────────┘  └──────────────┘   │
│       Fleet Dashboard · 3D Office · Board Memory │
└──────────────────┬──────────────┬────────────────┘
                   │              │
           ┌───────┘              └────────┐
           ▼                               ▼
┌──────────────────┐            ┌──────────────────┐
│  SquidJob Node A │            │  SquidJob Node B │
│  ┌────────────┐  │            │  ┌────────────┐  │
│  │ Next.js    │  │            │  │ Next.js    │  │
│  │ tenacitOS  │  │            │  │ tenacitOS  │  │
│  └────────────┘  │            │  └────────────┘  │
│  ┌────────────┐  │            │  ┌────────────┐  │
│  │ OpenClaw   │  │            │  │ OpenClaw   │  │
│  │ Agents     │  │            │  │ Agents     │  │
│  └────────────┘  │            │  └────────────┘  │
└──────────────────┘            └──────────────────┘
```

## Sync Protocol

### Registration

A Node registers with the Hub once:

```
POST /v1/nodes/register
Authorization: Bearer <tenant_api_token>
{
  "name": "my-machine",
  "url": "https://my-machine.local:3200",
  "api_key": "sqn_randomkey123"
}

Response:
{
  "node": { "id": "uuid", "name": "my-machine", "status": "offline" },
  "message": "Node registered. Save api_key — it won't be shown again."
}
```

The api_key is stored as a SHA-256 hash. The node stores the raw key in `NODE_HUB_API_KEY`.

### Heartbeat (every 60s)

```
POST /v1/nodes/:id/heartbeat
Authorization: Bearer <node_api_key>
{
  "cpu_percent": 45,
  "memory_percent": 62,
  "disk_percent": 31,
  "uptime_seconds": 86400,
  "agent_statuses": [
    { "id": "main", "name": "Main", "status": "active", "model": "gpt-4o" },
    { "id": "researcher", "name": "Researcher", "status": "idle", "model": "claude-3.5-sonnet" }
  ]
}
```

Hub updates `nodes.last_heartbeat`, `nodes.status = 'online'`, `nodes.agent_count`, stores heartbeat row, and cleans up heartbeats older than 7 days.

### Telemetry (every 5min)

```
POST /v1/nodes/:id/telemetry
Authorization: Bearer <node_api_key>
{
  "entries": [
    { "type": "session", "payload": { "agent_id": "main", "messages": 42 }, "recorded_at": "2025-01-01T00:00:00Z" },
    { "type": "cost", "payload": { "model": "gpt-4o", "tokens": 15000, "cost_usd": 0.15 } },
    { "type": "activity", "payload": { "event": "task_completed", "agent_id": "main" } }
  ]
}
```

### Status Checker

Hub runs a background job every 60s:
- No heartbeat in 90s → `degraded`
- No heartbeat in 3min → `offline`

## Node Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENCLAW_DIR` | Path to OpenClaw directory | No (default: `~/.openclaw`) |
| `NODE_NAME` | Display name for this node | No (default: hostname) |
| `ADMIN_PASSWORD` | Password for local UI access | No (default: `admin`) |
| `NODE_HUB_URL` | Hub API base URL | No (standalone if empty) |
| `NODE_HUB_API_KEY` | API key from registration | No (standalone if empty) |
| `NODE_ID` | UUID from registration | No (standalone if empty) |

## Deployment Guide

### Node Setup

1. Install Node.js 18+ on the target machine
2. Clone the SquidJob repo and navigate to `node/`
3. Run `npm install`
4. Copy `.env.example` to `.env.local` and configure
5. For standalone mode: just set `ADMIN_PASSWORD`
6. For Hub mode: register via Hub Fleet page, then set `NODE_HUB_URL`, `NODE_HUB_API_KEY`, `NODE_ID`
7. Run `npm run dev` (development) or `npm run build && npm start` (production)

### Hub Registration Flow

1. Go to Hub → Fleet page → "Register Node"
2. Enter node name, click register
3. Copy the generated API key (shown once)
4. On the node machine, set the three env vars
5. Restart the node — it will begin sending heartbeats

## Database Tables

### `nodes`
Stores registered nodes with status, system info, agent count.

### `node_heartbeats`
Rolling log of heartbeat data (CPU, RAM, disk, agent statuses). Cleaned up after 7 days.

### `node_telemetry`
Batched telemetry entries (sessions, costs, activity) pushed from nodes.

### `board_memories`
Board-level shared memory — notes, decisions, context, and references attached to board groups.
