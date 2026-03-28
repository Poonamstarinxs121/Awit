'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, RefreshCw, Filter } from 'lucide-react';

interface ActivityLog {
  id: string;
  agent_id: string;
  agent_name?: string;
  event_type: string;
  description: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
}

const EVENT_COLORS: Record<string, string> = {
  'agent_started': '#22C55E',
  'agent_stopped': '#EF4444',
  'agent_error': '#EF4444',
  'message_sent': '#3B82F6',
  'message_received': '#3B82F6',
  'session_started': '#22C55E',
  'session_ended': '#EF4444',
  'memory_updated': '#F59E0B',
  'config_changed': '#8B5CF6',
  'heartbeat': '#06B6D4',
};

function eventIcon(eventType: string): string {
  const type = eventType.toLowerCase();
  if (type.includes('start')) return '▶';
  if (type.includes('stop') || type.includes('end')) return '⏹';
  if (type.includes('error')) return '✕';
  if (type.includes('message')) return '💬';
  if (type.includes('memory')) return '🧠';
  if (type.includes('heartbeat')) return '💓';
  return '•';
}

function eventColor(eventType: string): string {
  return EVENT_COLORS[eventType] || '#64748B';
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function timeSince(dateStr: string): string {
  const d = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filterAgent, setFilterAgent] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [limit, setLimit] = useState(100);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams();
      if (filterAgent) params.append('agent_id', filterAgent);
      if (filterEvent) params.append('event_type', filterEvent);
      params.append('limit', String(limit));

      const res = await fetch(`/api/activity?${params}`);
      const data = await res.json();
      setActivities(data.activities || []);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setRefreshing(false);
    }
  }, [filterAgent, filterEvent, limit]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    setLoading(true);
    fetchActivities().then(() => setLoading(false));
  }, [fetchActivities]);

  const uniqueEventTypes = Array.from(new Set(activities.map(a => a.event_type))).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>
          Activity
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
          All operations and events across your node
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        padding: 12,
        backgroundColor: 'var(--surface-elevated)',
        borderRadius: 8,
        border: '1px solid var(--border-color)',
      }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
            Filter by Agent
          </label>
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <option value="">All Agents</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
            Filter by Event Type
          </label>
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <option value="">All Events</option>
            {uniqueEventTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
            Show Limit
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={500}>Last 500</option>
            <option value={1000}>Last 1000</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => fetchActivities()}
            disabled={refreshing}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Activity List */}
      <div style={{
        flex: 1,
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading activity logs...
          </div>
        ) : activities.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            No activity logs found
          </div>
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            {activities.map((activity, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  padding: 12,
                  borderBottom: idx < activities.length - 1 ? '1px solid var(--border-color)' : 'none',
                  alignItems: 'flex-start',
                  gap: 12,
                  backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-elevated)',
                  transition: 'background-color 200ms',
                }}
              >
                {/* Icon */}
                <div style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  backgroundColor: `${eventColor(activity.event_type)}20`,
                  color: eventColor(activity.event_type),
                  fontSize: 16,
                  fontWeight: 600,
                }}>
                  {eventIcon(activity.event_type)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    marginBottom: 4,
                  }}>
                    <div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: 2,
                      }}>
                        {activity.event_type}
                        {activity.agent_name && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> • {activity.agent_name}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {activity.description}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      textAlign: 'right',
                    }}>
                      <div>{formatTime(activity.created_at)}</div>
                      <div>{timeSince(activity.created_at)}</div>
                    </div>
                  </div>

                  {/* Metadata */}
                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginTop: 6,
                      padding: '6px 8px',
                      backgroundColor: 'var(--surface)',
                      borderRadius: 4,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {JSON.stringify(activity.metadata, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
