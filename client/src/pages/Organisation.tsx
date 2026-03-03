import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Shield, Globe, Key, CreditCard } from 'lucide-react';
import { apiGet } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface Agent {
  id: string;
  name: string;
  status: string;
  role: string;
  level: string;
}

export function Organisation() {
  const { user } = useAuth();

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiGet<{ agents: Agent[] }>('/v1/agents'),
  });

  const { data: providersData } = useQuery({
    queryKey: ['providers'],
    queryFn: () => apiGet<{ providers: { id: string; provider: string; status: string }[] }>('/v1/config/providers'),
  });

  const agents = agentsData?.agents ?? [];
  const providers = providersData?.providers ?? [];
  const activeAgents = agents.filter(a => a.status === 'active');

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
      </div>
    );
  }

  function SectionCard({ title, icon: Icon, children, subtitle }: { title: string; icon: typeof Building2; children: React.ReactNode; subtitle?: string }) {
    return (
      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{title}</h3>
            {subtitle && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</p>}
          </div>
        </div>
        <div style={{ padding: '16px 20px' }}>{children}</div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Agents', value: agents.length, sub: `${activeAgents.length} active`, color: '#32D74B' },
    { label: 'Role', value: user?.role || 'User', sub: 'Your access level', color: '#60A5FA' },
    { label: 'Providers', value: providers.filter(p => p.status === 'active').length, sub: `${providers.length} configured`, color: '#A78BFA' },
    { label: 'Plan', value: 'Starter', sub: 'Current plan', color: '#FFD60A' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
          Organisation
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Manage your organisation, members, and configuration</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {statCards.map(s => (
          <div key={s.label} style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '6px' }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <SectionCard title="Organisation Details" icon={Building2} subtitle="Your workspace information">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <InfoRow label="Organisation Name" value={user?.tenantName || 'My Organisation'} />
            <InfoRow label="Your Name" value={user?.name || '—'} />
            <InfoRow label="Email" value={user?.email || '—'} />
            <InfoRow label="Role" value={user?.role || '—'} />
          </div>
        </SectionCard>

        <SectionCard title="Subscription" icon={CreditCard} subtitle="Plan and billing information">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <InfoRow label="Current Plan" value="Starter" />
            <InfoRow label="Status" value="Active" />
            <InfoRow label="Agents Limit" value="10" />
            <InfoRow label="Tasks Limit" value="Unlimited" />
          </div>
          <button
            style={{
              marginTop: '12px', width: '100%', padding: '9px', borderRadius: '8px',
              backgroundColor: 'var(--accent)', color: '#fff', border: 'none',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
            onClick={() => window.location.href = '/subscription'}
          >
            Manage Billing
          </button>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <SectionCard title="Team Members" icon={Users} subtitle="Active agents and operators">
          {agents.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No agents yet. Create agents to get started.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {agents.slice(0, 6).map(agent => (
                <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: agent.status === 'active' ? 'rgba(50,215,75,0.15)' : 'var(--surface-elevated)',
                    border: `1px solid ${agent.status === 'active' ? 'rgba(50,215,75,0.3)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 600, color: agent.status === 'active' ? '#32D74B' : 'var(--text-muted)',
                  }}>
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{agent.role || agent.level}</p>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                    backgroundColor: agent.status === 'active' ? 'rgba(50,215,75,0.12)' : 'rgba(156,163,175,0.12)',
                    color: agent.status === 'active' ? '#32D74B' : '#9CA3AF',
                  }}>{agent.status}</span>
                </div>
              ))}
              {agents.length > 6 && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4px' }}>+{agents.length - 6} more agents</p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard title="API Providers" icon={Key} subtitle="Connected LLM providers">
          {providers.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No providers configured. Add API keys in Settings.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {providers.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{p.provider}</span>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                    backgroundColor: p.status === 'active' ? 'rgba(50,215,75,0.12)' : 'rgba(156,163,175,0.12)',
                    color: p.status === 'active' ? '#32D74B' : '#9CA3AF',
                  }}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Permissions & Access" icon={Shield} subtitle="Role-based access control">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {[
            { role: 'Owner', desc: 'Full access to all features, billing, and member management', color: '#FF3B30' },
            { role: 'Admin', desc: 'Manage agents, tasks, integrations. Cannot manage billing.', color: '#FF9500' },
            { role: 'Operator', desc: 'Create and manage tasks and agents. Read-only settings.', color: '#0A84FF' },
            { role: 'Viewer', desc: 'Read-only access to dashboards and reports.', color: '#636366' },
          ].map(r => (
            <div key={r.role} style={{
              padding: '12px 14px', borderRadius: '10px',
              backgroundColor: user?.role === r.role ? 'rgba(255,59,48,0.06)' : 'var(--surface-elevated)',
              border: `1px solid ${user?.role === r.role ? 'rgba(255,59,48,0.2)' : 'var(--border)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: r.color }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.role}</span>
                {user?.role === r.role && <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, marginLeft: 'auto' }}>You</span>}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
