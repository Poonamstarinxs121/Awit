import { NODE_CONFIG, isHubConfigured } from '../config/node';
import { getSystemStats } from './system-monitor';
import { discoverAgents } from './openclaw-reader';

export class HubSyncClient {
  private hubUrl: string;
  private apiKey: string;
  private nodeId: string;

  constructor() {
    this.hubUrl = NODE_CONFIG.hubUrl;
    this.apiKey = NODE_CONFIG.hubApiKey;
    this.nodeId = NODE_CONFIG.nodeId;
  }

  isConfigured(): boolean {
    return isHubConfigured();
  }

  async sendHeartbeat(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const stats = getSystemStats();
      const agents = discoverAgents();
      const agentStatuses = agents.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        model: a.model,
      }));
      const res = await fetch(`${this.hubUrl}/v1/nodes/${this.nodeId}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
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
      const res = await fetch(`${this.hubUrl}/v1/nodes/${this.nodeId}/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
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

  console.log('[HubSync] Starting hub sync to', NODE_CONFIG.hubUrl);

  client.sendHeartbeat().then(ok => {
    if (ok) lastHeartbeat = new Date();
  });

  setInterval(async () => {
    const ok = await client.sendHeartbeat();
    if (ok) lastHeartbeat = new Date();
  }, 60000);

  setInterval(async () => {
    const ok = await client.sendTelemetry([]);
    if (ok) lastTelemetry = new Date();
  }, 300000);
}
