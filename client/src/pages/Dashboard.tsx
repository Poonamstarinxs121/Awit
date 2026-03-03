import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Zap, CheckCircle, ShieldCheck, Brain, Server, MessageSquare, Columns3, BarChart3, DollarSign, Settings } from 'lucide-react';
import { StatsCard } from '../components/ui/StatsCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ActivityFeed } from '../components/ActivityFeed';
import { apiGet } from '../api/client';

interface Stats { total: number; today: number; success: number; error: number; }
interface Agent { id: string; name: string; emoji?: string; color?: string; status: string; model?: string; }

const quickLinks = [
  { to: '/agents', label: 'Agents', icon: Bot, color: 'var(--accent)' },
  { to: '/boards', label: 'Boards', icon: Columns3, color: 'var(--info)' },
  { to: '/kanban', label: 'Board', icon: MessageSquare, color: 'var(--positive)' },
  { to: '/memory', label: 'Memory', icon: Brain, color: 'var(--type-command)' },
  { to: '/machines', label: 'Machines', icon: Server, color: 'var(--type-file)' },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck, color: 'var(--warning)' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, color: '#FF9500' },
  { to: '/costs', label: 'Costs', icon: DollarSign, color: 'var(--positive)' },
  { to: '/settings', label: 'Settings', icon: Settings, color: 'var(--text-muted)' },
];

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, success: 0, error: 0 });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    Promise.all([
      apiGet<any>('/v1/activity/stats').catch(() => null),
      apiGet<{ agents: Agent[] }>('/v1/agents').catch(() => ({ agents: [] })),
      apiGet<{ pending: number }>('/v1/approvals/count').catch(() => ({ pending: 0 })),
    ]).then(([actStats, agentsData, approvalData]) => {
      if (actStats) setStats({ total: actStats.total || 0, today: actStats.today || 0, success: actStats.success || 0, error: actStats.error || 0 });
      setAgents(agentsData?.agents || []);
      setPendingApprovals(approvalData?.pending || 0);
    }).catch(console.error);
  }, []);

  const onlineAgents = agents.filter(a => a.status === 'online');

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-1px', marginBottom: '4px' }}>
          🦑 Mission Control
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Overview of your SquidJob agent workforce
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatsCard title="Total Agents" value={agents.length} icon={<Bot size={18} />} iconColor="var(--accent)" />
        <StatsCard title="Today's Events" value={stats.today} icon={<Zap size={18} />} iconColor="var(--info)" />
        <StatsCard title="Successful" value={stats.success} icon={<CheckCircle size={18} />} iconColor="var(--positive)" />
        <StatsCard title="Pending Approvals" value={pendingApprovals} icon={<ShieldCheck size={18} />} iconColor="var(--warning)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <SectionHeader title="Recent Activity" rightAction={<Link to="/activity" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '12px' }}>View all →</Link>} />
          <ActivityFeed limit={8} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <SectionHeader title={`Online Agents (${onlineAgents.length}/${agents.length})`} rightAction={<Link to="/agents" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '12px' }}>Manage →</Link>} />
            <div style={{ padding: '8px 0' }}>
              {agents.slice(0, 5).map(agent => (
                <div key={agent.id} className="flex items-center gap-3" style={{ padding: '8px 16px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: agent.color ? `${agent.color}22` : 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                    {agent.emoji || '🤖'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="line-clamp-1" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{agent.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{agent.model || 'no model'}</div>
                  </div>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: agent.status === 'online' ? 'var(--positive)' : 'var(--text-muted)', flexShrink: 0 }} />
                </div>
              ))}
              {agents.length === 0 && <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No agents yet</div>}
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <SectionHeader title="Quick Links" />
            <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {quickLinks.map(({ to, label, icon: Icon, color }) => (
                <Link key={to} to={to} style={{ textDecoration: 'none' }}>
                  <div className="flex flex-col items-center gap-1.5"
                    style={{ padding: '10px 6px', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 150ms ease' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-hover)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <Icon size={18} style={{ color }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
