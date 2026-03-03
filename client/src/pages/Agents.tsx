import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Key, Zap } from 'lucide-react';
import { apiGet } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import type { Agent } from '../types';

const statusDot: Record<string, string> = {
  active: 'var(--positive)',
  idle: 'var(--text-muted)',
  error: 'var(--negative)',
  disabled: 'var(--text-muted)',
};

const statusLabel: Record<string, string> = {
  active: 'Active',
  idle: 'Idle',
  error: 'Error',
  disabled: 'Disabled',
};

const levelColors: Record<string, { bg: string; text: string }> = {
  lead: { bg: 'var(--warning-soft)', text: 'var(--warning)' },
  specialist: { bg: 'var(--info-soft)', text: 'var(--info)' },
  intern: { bg: 'var(--surface-elevated)', text: 'var(--text-muted)' },
};

const ACCENT_COLORS = ['#FF3B30', '#0A84FF', '#32D74B', '#FF9500', '#BF5AF2', '#FF375F', '#64D2FF', '#FFD60A'];

export function Agents() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiGet<{ agents: Agent[] }>('/v1/agents'),
  });
  const { data: providersData } = useQuery({
    queryKey: ['providers'],
    queryFn: () => apiGet<{ providers: { id: string; provider: string }[] }>('/v1/config/providers'),
    retry: false,
  });

  const agents = data?.agents ?? [];
  const hasProvider = (providersData?.providers ?? []).length > 0;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Agent Roster
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Your AI agent squad</p>
        </div>
        <Button onClick={() => navigate('/agents/new')}>
          <Plus size={16} style={{ marginRight: '6px' }} />
          Create Agent
        </Button>
      </div>

      {!hasProvider && !isLoading && (
        <div style={{ backgroundColor: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px' }}>
          <Key size={16} style={{ color: 'var(--warning)', marginTop: '2px', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warning)', marginBottom: '2px' }}>No AI provider connected</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Your agents won't respond without an API key.{' '}
              <button onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: 0, textDecoration: 'underline' }}>
                Go to Settings → API Providers
              </button>
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center" style={{ padding: '80px' }}>
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: 'var(--negative-soft)', border: '1px solid var(--negative)', borderRadius: '10px', padding: '16px', color: 'var(--negative)', fontSize: '13px' }}>
          Failed to load agents: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && agents.length === 0 && (
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '80px', textAlign: 'center' }}>
          <Users size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '4px' }}>No agents in the squad yet.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Create your first agent to get started.</p>
        </div>
      )}

      {!isLoading && !error && agents.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {agents.map((agent, index) => {
            const dotColor = statusDot[agent.status] || 'var(--text-muted)';
            const label = statusLabel[agent.status] || agent.status;
            const lvl = levelColors[agent.level] || levelColors.intern;
            const accentColor = ACCENT_COLORS[index % ACCENT_COLORS.length];
            const modelConfig = (agent as any).model_config || {};
            const model = modelConfig.model || '';

            return (
              <div
                key={agent.id}
                onClick={() => navigate(`/agents/${agent.id}`)}
                style={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '18px',
                  cursor: 'pointer',
                  transition: 'border-color 150ms ease, background-color 150ms ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-elevated)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--card)'; }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', backgroundColor: accentColor, borderRadius: '2px 0 0 2px' }} />
                <div className="flex items-start gap-3">
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: `${accentColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: accentColor, flexShrink: 0 }}>
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                      <h3 className="line-clamp-1" style={{ fontSize: '14px', fontWeight: 600, color: agent.status === 'disabled' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: agent.status === 'disabled' ? 'line-through' : 'none' }}>
                        {agent.name}
                      </h3>
                      {agent.is_default && (
                        <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: 'var(--surface-elevated)', padding: '1px 6px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Default</span>
                      )}
                    </div>
                    <p className="line-clamp-1" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>{agent.role}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dotColor }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                      </div>
                      <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', backgroundColor: lvl.bg, color: lvl.text, fontWeight: 600, textTransform: 'capitalize' }}>
                        {agent.level}
                      </span>
                      {model && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} className="line-clamp-1">{model}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
