'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Zap, Clock, Hash, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import HelpBanner from '@/components/HelpBanner';

interface Session {
  id: number;
  agent_id: string;
  agent_name: string;
  model: string;
  status: string;
  messages: number;
  tokens_in: number;
  tokens_out: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
}

const AGENT_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6'];

function agentColor(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

function statusColor(status: string): string {
  switch (status) {
    case 'active': return 'var(--positive)';
    case 'completed': return 'var(--text-muted)';
    case 'error': return 'var(--negative)';
    default: return 'var(--text-secondary)';
  }
}

function statusBg(status: string): string {
  switch (status) {
    case 'active': return 'rgba(34,197,94,0.1)';
    case 'completed': return 'rgba(85,85,85,0.15)';
    case 'error': return 'rgba(239,68,68,0.1)';
    default: return 'rgba(136,136,136,0.1)';
  }
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diff = Math.max(0, end - start);
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const STAT_CARDS = [
  { key: 'total', label: 'Total Sessions', icon: Hash, color: '#3B82F6' },
  { key: 'active', label: 'Active', icon: Zap, color: '#22C55E' },
  { key: 'messages', label: 'Messages Today', icon: MessageSquare, color: '#F59E0B' },
  { key: 'tokens', label: 'Tokens Today', icon: Clock, color: '#8B5CF6' },
];

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [filterAgent, setFilterAgent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const [todaySessions, setTodaySessions] = useState<Session[]>([]);

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterAgent) params.set('agent_id', filterAgent);
      if (filterStatus) params.set('status', filterStatus);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      params.set('limit', '100');

      const res = await fetch(`/api/sessions?${params.toString()}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setTotal(data.total || 0);
    } catch {
      /* ignore */
    }
  }, [filterAgent, filterStatus, filterFrom, filterTo]);

  const fetchTodaySessions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('from', todayISO());
      params.set('limit', '1000');
      const res = await fetch(`/api/sessions?${params.toString()}`);
      const data = await res.json();
      setTodaySessions(data.sessions || []);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSessions(), fetchTodaySessions(), fetchAgents()]).finally(() => setLoading(false));
  }, [fetchSessions, fetchTodaySessions, fetchAgents]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchSessions();
      fetchTodaySessions();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions, fetchTodaySessions]);

  const activeSessions = sessions.filter(s => s.status === 'active').length;
  const messagesToday = todaySessions.reduce((acc, s) => acc + (s.messages || 0), 0);
  const tokensToday = todaySessions.reduce((acc, s) => acc + (s.tokens_in || 0) + (s.tokens_out || 0), 0);

  const stats: Record<string, string | number> = {
    total,
    active: activeSessions,
    messages: messagesToday,
    tokens: formatTokens(tokensToday),
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600 }}>
          Sessions
        </h1>
        <button
          onClick={() => { fetchSessions(); fetchTodaySessions(); }}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 12px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <HelpBanner
        pageKey="sessions"
        title="Session History"
        description="Sessions are logged each time an agent runs a conversation. All data is stored locally in SQLite and synced to Hub every 5 minutes."
        tips={[
          'Sessions track token usage, cost, and duration per conversation',
          'Click a session row to expand and see full details',
          'Filter by agent or status to drill into specific activity',
        ]}
      />

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

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 13,
              minWidth: 160,
            }}
          >
            <option value="">All Agents</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 13,
              minWidth: 140,
            }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="error">Error</option>
          </select>

          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            placeholder="From"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 13,
              colorScheme: 'dark',
            }}
          />

          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            placeholder="To"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 13,
              colorScheme: 'dark',
            }}
          />

          {(filterAgent || filterStatus || filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterAgent(''); setFilterStatus(''); setFilterFrom(''); setFilterTo(''); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No sessions recorded yet
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 100px 80px 100px 90px 140px 32px',
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: 11,
              color: 'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
            }}>
              <span>Agent</span>
              <span>Model</span>
              <span>Status</span>
              <span>Msgs</span>
              <span>Tokens</span>
              <span>Duration</span>
              <span>Started</span>
              <span></span>
            </div>

            {sessions.map(session => (
              <div key={session.id}>
                <div
                  onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 100px 80px 100px 90px 140px 32px',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    background: expandedId === session.id ? 'var(--surface-elevated)' : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (expandedId !== session.id) (e.currentTarget as HTMLElement).style.background = 'var(--background)';
                  }}
                  onMouseLeave={e => {
                    if (expandedId !== session.id) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: agentColor(session.agent_id || ''),
                      flexShrink: 0,
                    }} />
                    {session.agent_name || session.agent_id || 'Unknown'}
                  </span>

                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {session.model || '—'}
                  </span>

                  <span>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 500,
                      background: statusBg(session.status),
                      color: statusColor(session.status),
                    }}>
                      {session.status}
                    </span>
                  </span>

                  <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {session.messages ?? 0}
                  </span>

                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {formatTokens((session.tokens_in || 0) + (session.tokens_out || 0))}
                  </span>

                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {session.started_at ? formatDuration(session.started_at, session.ended_at) : '—'}
                  </span>

                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {session.started_at ? formatTime(session.started_at) : '—'}
                  </span>

                  <span style={{ color: 'var(--text-muted)' }}>
                    {expandedId === session.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>

                {expandedId === session.id && (
                  <div style={{
                    padding: '16px 24px',
                    background: 'var(--surface-elevated)',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 12 }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Session ID</div>
                        <div style={{ fontFamily: 'var(--font-mono)' }}>{session.id}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Agent ID</div>
                        <div style={{ fontFamily: 'var(--font-mono)' }}>{session.agent_id || '—'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Model</div>
                        <div style={{ fontFamily: 'var(--font-mono)' }}>{session.model || '—'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Tokens In</div>
                        <div style={{ fontFamily: 'var(--font-mono)' }}>{formatTokens(session.tokens_in || 0)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Tokens Out</div>
                        <div style={{ fontFamily: 'var(--font-mono)' }}>{formatTokens(session.tokens_out || 0)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Messages</div>
                        <div style={{ fontFamily: 'var(--font-mono)' }}>{session.messages ?? 0}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Started</div>
                        <div>{session.started_at ? new Date(session.started_at).toLocaleString() : '—'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Ended</div>
                        <div>{session.ended_at ? new Date(session.ended_at).toLocaleString() : '—'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Duration</div>
                        <div>{session.started_at ? formatDuration(session.started_at, session.ended_at) : '—'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{
        marginTop: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: 'var(--text-muted)',
        padding: '0 4px',
      }}>
        <span>Showing {sessions.length} of {total} sessions</span>
        <span>Auto-refreshes every 10s</span>
      </div>
    </div>
  );
}
