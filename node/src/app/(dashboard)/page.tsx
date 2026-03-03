'use client';

import { useEffect, useState } from 'react';
import { Bot, MessageSquare, Activity, DollarSign, Wifi, WifiOff } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  model?: string;
  status: string;
}

interface HubStatus {
  configured: boolean;
  hubUrl: string | null;
  nodeId: string | null;
  lastHeartbeat: string | null;
}

const STAT_CARDS = [
  { key: 'agents', label: 'Total Agents', icon: Bot, color: '#3B82F6' },
  { key: 'sessions', label: 'Active Sessions', icon: MessageSquare, color: '#22C55E' },
  { key: 'activity', label: "Today's Activity", icon: Activity, color: '#F59E0B' },
  { key: 'cost', label: 'Est. Cost Today', icon: DollarSign, color: '#8B5CF6' },
];

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hubStatus, setHubStatus] = useState<HubStatus | null>(null);

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(d => setAgents(d.agents || [])).catch(() => {});
    fetch('/api/hub/status').then(r => r.json()).then(setHubStatus).catch(() => {});
  }, []);

  const stats: Record<string, string | number> = {
    agents: agents.length,
    sessions: 0,
    activity: 0,
    cost: '$0.00',
  };

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, marginBottom: 20 }}>
        Dashboard
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {STAT_CARDS.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.key} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${card.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon size={20} style={{ color: card.color }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {stats[card.key]}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: 'var(--font-heading)' }}>
            Agents ({agents.length})
          </h2>
          {agents.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
              No agents discovered. Place an <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '2px 6px', borderRadius: 4 }}>openclaw.json</code> in your OpenClaw directory.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {agents.map(agent => (
                <div key={agent.id} style={{
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: agent.status === 'active' ? 'var(--positive)' : 'var(--text-muted)',
                    }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{agent.name}</span>
                  </div>
                  {agent.model && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {agent.model}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: 'var(--font-heading)' }}>
            Hub Connection
          </h2>
          {hubStatus ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                {hubStatus.configured ? (
                  <Wifi size={20} style={{ color: 'var(--positive)' }} />
                ) : (
                  <WifiOff size={20} style={{ color: 'var(--text-muted)' }} />
                )}
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {hubStatus.configured ? 'Connected' : 'Standalone Mode'}
                </span>
              </div>
              {hubStatus.configured ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div style={{ marginBottom: 6 }}>Hub: <span style={{ fontFamily: 'var(--font-mono)' }}>{hubStatus.hubUrl}</span></div>
                  <div style={{ marginBottom: 6 }}>Node ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{hubStatus.nodeId}</span></div>
                  {hubStatus.lastHeartbeat && (
                    <div>Last heartbeat: {new Date(hubStatus.lastHeartbeat).toLocaleTimeString()}</div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Set <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 4px', borderRadius: 3 }}>NODE_HUB_URL</code>,{' '}
                  <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 4px', borderRadius: 3 }}>NODE_HUB_API_KEY</code>, and{' '}
                  <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 4px', borderRadius: 3 }}>NODE_ID</code>{' '}
                  to connect to SquidJob Hub.
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}
