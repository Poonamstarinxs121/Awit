import { useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, List, Box, Users } from 'lucide-react';
import { apiGet } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
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

const ACCENT_COLORS = ['#FF3B30', '#0A84FF', '#32D74B', '#FF9500', '#BF5AF2', '#FF375F', '#64D2FF', '#FFD60A'];

function AgentListView({ agents }: { agents: Agent[] }) {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', padding: '20px 0' }}>
      {agents.map((agent, index) => {
        const dotColor = statusDot[agent.status] || 'var(--text-muted)';
        const label = statusLabel[agent.status] || agent.status;
        const accentColor = ACCENT_COLORS[index % ACCENT_COLORS.length];
        const model = (agent.model_config as any)?.model || '';

        return (
          <div
            key={agent.id}
            onClick={() => navigate(`/agents/${agent.id}`)}
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              cursor: 'pointer',
              transition: 'border-color 150ms, background-color 150ms',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.backgroundColor = 'var(--card)';
            }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', backgroundColor: accentColor }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                backgroundColor: `${accentColor}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 700, color: accentColor,
                fontFamily: 'var(--font-heading)',
              }}>
                {agent.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {agent.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dotColor }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</span>
                  </div>
                  {model && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{model}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OfficePage() {
  const [view, setView] = useState<'3d' | 'list'>('3d');

  const { data, isLoading, error } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiGet<{ agents: Agent[] }>('/v1/agents'),
  });

  const agents = data?.agents ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.5px',
          }}>
            3D Office
          </h1>
          <span style={{
            backgroundColor: 'var(--accent-soft)',
            color: 'var(--accent)',
            fontSize: '12px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '12px',
          }}>
            {agents.length} agent{agents.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{
          display: 'flex',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setView('3d')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px',
              fontSize: '12px', fontWeight: 600,
              border: 'none', cursor: 'pointer',
              backgroundColor: view === '3d' ? 'var(--accent-soft)' : 'transparent',
              color: view === '3d' ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'background-color 150ms, color 150ms',
            }}
          >
            <Box size={14} />
            3D
          </button>
          <button
            onClick={() => setView('list')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px',
              fontSize: '12px', fontWeight: 600,
              border: 'none', cursor: 'pointer',
              backgroundColor: view === 'list' ? 'var(--accent-soft)' : 'transparent',
              color: view === 'list' ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'background-color 150ms, color 150ms',
            }}
          >
            <List size={14} />
            List
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: 'var(--negative-soft)',
          border: '1px solid var(--negative)',
          borderRadius: '10px',
          padding: '16px',
          color: 'var(--negative)',
          fontSize: '13px',
        }}>
          Failed to load agents: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && agents.length === 0 && (
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '4px' }}>No agents in the office.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Create agents to populate the 3D office.</p>
        </div>
      )}

      {!isLoading && !error && agents.length > 0 && view === 'list' && (
        <AgentListView agents={agents} />
      )}

      {!isLoading && !error && agents.length > 0 && view === '3d' && (
        <div style={{
          flex: 1,
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          minHeight: '500px',
        }}>
          <Suspense fallback={
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C0C0C' }}>
              <Spinner size="lg" />
            </div>
          }>
            <OfficeSceneLazy agents={agents} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

import { lazy } from 'react';
const OfficeSceneLazy = lazy(() =>
  import('../components/office/OfficeScene').then(m => ({ default: m.OfficeScene }))
);
