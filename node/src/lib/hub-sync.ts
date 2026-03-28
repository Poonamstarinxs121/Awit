import { NODE_CONFIG, isHubConfigured } from '../config/node';
import { getSystemStats } from './system-monitor';
import { discoverAgents } from './openclaw-reader';
import { getSyncState, setSyncState, getSessionsSince, getCostsSince, getActivitySince } from './local-db';
import { startDispatchWorker } from './dispatch-worker';

function isUpdatePaused(): boolean {
  try { return getSyncState('services_paused') === 'true'; } catch { return false; }
}

export class HubSyncClient {
  isConfigured(): boolean {
    return isHubConfigured();
  }

  async sendHeartbeat(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    if (isUpdatePaused()) { console.log('[HubSync] Skipping heartbeat — services paused for update'); return false; }
    try {
      const stats = getSystemStats();
      const agents = discoverAgents();
      const agentStatuses = agents.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        model: a.model,
      }));
      const res = await fetch(`${NODE_CONFIG.hubUrl}/v1/nodes/${NODE_CONFIG.nodeId}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NODE_CONFIG.hubApiKey}`,
        },
        body: JSON.stringify({
          cpu_percent: stats.cpu_percent,
          memory_percent: stats.memory_percent,
          disk_percent: stats.disk_percent,
          uptime_seconds: stats.uptime_seconds,
          agent_statuses: agentStatuses,
        }),
      });
      return res.ok;
    } catch (error) {
      console.error('[HubSync] Heartbeat failed:', error);
      return false;
    }
  }

  async sendTelemetry(entries: Array<{ type: string; payload: any; recorded_at?: string }>): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${NODE_CONFIG.hubUrl}/v1/nodes/${NODE_CONFIG.nodeId}/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NODE_CONFIG.hubApiKey}`,
        },
        body: JSON.stringify({ entries }),
      });
      return res.ok;
    } catch (error) {
      console.error('[HubSync] Telemetry failed:', error);
      return false;
    }
  }
}

let syncClient: HubSyncClient | null = null;
let lastHeartbeat: Date | null = null;
let lastTelemetry: Date | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let telemetryInterval: ReturnType<typeof setInterval> | null = null;
let schedulerRunning = false;

export function getHubSyncClient(): HubSyncClient {
  if (!syncClient) syncClient = new HubSyncClient();
  return syncClient;
}

export function getHubStatus() {
  const client = getHubSyncClient();
  return {
    configured: client.isConfigured(),
    hubUrl: NODE_CONFIG.hubUrl || null,
    nodeId: NODE_CONFIG.nodeId || null,
    nodeName: NODE_CONFIG.nodeName || null,
    openclawDir: NODE_CONFIG.openclawDir || null,
    lastHeartbeat: lastHeartbeat?.toISOString() || null,
    lastTelemetry: lastTelemetry?.toISOString() || null,
  };
}

export function startHubScheduler() {
  const client = getHubSyncClient();
  if (!client.isConfigured()) {
    console.log('[HubSync] Not configured — running in standalone mode');
    return;
  }

  if (schedulerRunning) {
    console.log('[HubSync] Scheduler already running, skipping');
    return;
  }

  schedulerRunning = true;
  console.log('[HubSync] Starting hub sync to', NODE_CONFIG.hubUrl);

  client.sendHeartbeat().then(ok => {
    if (ok) lastHeartbeat = new Date();
  });

  heartbeatInterval = setInterval(async () => {
    const ok = await client.sendHeartbeat();
    if (ok) lastHeartbeat = new Date();
  }, 60000);

  collectAndSendTelemetry(client).then(ok => {
    if (ok) lastTelemetry = new Date();
  });

  telemetryInterval = setInterval(async () => {
    const ok = await collectAndSendTelemetry(client);
    if (ok) lastTelemetry = new Date();
  }, 300000);

  startDispatchWorker();
}

export function reinitializeHubSync() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (telemetryInterval) clearInterval(telemetryInterval);
  heartbeatInterval = null;
  telemetryInterval = null;
  schedulerRunning = false;
  syncClient = null;
  startHubScheduler();
}

const SYNC_STATE_KEY = 'lastTelemetrySyncAt';

async function collectAndSendTelemetry(client: HubSyncClient): Promise<boolean> {
  if (!client.isConfigured()) return false;
  if (isUpdatePaused()) { console.log('[HubSync] Skipping telemetry — services paused for update'); return false; }

  try {
    const lastSync = getSyncState(SYNC_STATE_KEY) || '1970-01-01T00:00:00.000Z';
    const now = new Date().toISOString();

    const sessions = getSessionsSince(lastSync);
    const costs = getCostsSince(lastSync);
    const activities = getActivitySince(lastSync);

    const entries: Array<{ type: string; payload: any; recorded_at: string }> = [];

    for (const s of sessions) {
      entries.push({ type: 'session', payload: s, recorded_at: s.created_at || now });
    }
    for (const c of costs) {
      entries.push({ type: 'cost', payload: c, recorded_at: c.recorded_at || now });
    }
    for (const a of activities) {
      entries.push({ type: 'activity', payload: a, recorded_at: a.created_at || now });
    }

    if (entries.length === 0) {
      setSyncState(SYNC_STATE_KEY, now);
      return true;
    }

    const ok = await client.sendTelemetry(entries);
    if (ok) {
      setSyncState(SYNC_STATE_KEY, now);
    }
    return ok;
  } catch (error) {
    console.error('[HubSync] Telemetry collection failed:', error);
    return false;
  }
}
