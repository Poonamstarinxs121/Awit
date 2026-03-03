import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { History, Bot, TrendingUp, Hash, Search, RefreshCw } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatsCard } from '../components/ui/StatsCard';
import { apiGet } from '../api/client';

interface Session {
  id: string;
  agentName: string;
  agentEmoji: string;
  agentColor: string;
  model: string;
  modelProvider: string;
  status: string;
  lastActive?: string;
  messageCount: number;
  messagesToday: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export function SessionsPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiGet<{ sessions: Session[] }>('/v1/sessions'),
    refetchInterval: 30000,
  });

  const sessions = (data?.sessions || []).filter(s =>
    !search || s.agentName.toLowerCase().includes(search.toLowerCase())
  );

  const totalTokens = sessions.reduce((s, c) => s + c.totalTokens, 0);
  const totalMessages = sessions.reduce((s, c) => s + c.messageCount, 0);
  const activeCount = sessions.filter(s => s.status === 'online').length;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Sessions
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Agent session history and token usage</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
        >
          <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div className="mobile-grid-1 phone-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatsCard title="Active Agents" value={activeCount} icon={<Bot size={18} />} iconColor="var(--positive)" />
        <StatsCard title="Total Messages" value={totalMessages.toLocaleString()} icon={<Hash size={18} />} iconColor="var(--info)" />
        <StatsCard title="Total Tokens" value={totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens} icon={<TrendingUp size={18} />} iconColor="var(--type-command)" />
      </div>

      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div style={{ width: '3px', height: '18px', backgroundColor: 'var(--accent)', borderRadius: '2px' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Agent Sessions</h2>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filter agents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', width: '200px', outline: 'none' }}
            />
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No agents found</div>
        ) : (
          sessions.map((session, i) => (
            <div
              key={session.id}
              className="flex items-center gap-4"
              style={{ padding: '16px 20px', borderBottom: i < sessions.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background-color 150ms ease' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: `${session.agentColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                {session.agentEmoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{session.agentName}</span>
                  <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: session.status === 'online' ? 'var(--positive-soft)' : 'var(--surface-elevated)', color: session.status === 'online' ? 'var(--positive)' : 'var(--text-muted)' }}>
                    {session.status}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {session.model} · {session.modelProvider}
                  {session.lastActive && ` · active ${formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}`}
                </div>
              </div>
              <div className="flex items-center gap-6 mobile-hide">
                {[
                  { label: 'Messages', value: session.messageCount.toLocaleString(), color: 'var(--info)' },
                  { label: 'Today', value: session.messagesToday.toLocaleString(), color: 'var(--positive)' },
                  { label: 'Tokens', value: session.totalTokens > 1000 ? `${(session.totalTokens / 1000).toFixed(1)}K` : session.totalTokens, color: 'var(--type-command)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color, fontFamily: 'var(--font-heading)' }}>{value}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
