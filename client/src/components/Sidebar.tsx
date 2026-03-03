import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Columns3, Users, Clock, Settings, LogOut, HelpCircle, FileText, MessageSquare, Brain, Server, Activity, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';

const mainNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/boards', label: 'Boards', icon: Columns3 },
  { to: '/agents', label: 'Agents', icon: Users },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/standups', label: 'Standups', icon: Clock },
];

const knowledgeNav = [
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/memory-graph', label: 'Memory Graph', icon: Brain },
];

const commsNav = [
  { to: '/squad-chat', label: 'Squad Chat', icon: MessageSquare },
];

const infraNav = [
  { to: '/machines', label: 'Machines', icon: Server },
];

const governanceNav = [
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck },
];

const systemNav = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/help', label: 'Help Center', icon: HelpCircle },
];

function NavSection({ label, items, badge }: { label: string; items: typeof mainNav; badge?: Record<string, number> }) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-brand-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-[var(--surface-elevated)]'
            }`
          }
        >
          <item.icon size={17} />
          <span className="flex-1">{item.label}</span>
          {badge?.[item.to] ? (
            <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-danger text-white rounded-full">
              {badge[item.to] > 9 ? '9+' : badge[item.to]}
            </span>
          ) : null}
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();

  const { data: approvalCount } = useQuery({
    queryKey: ['approvals-count'],
    queryFn: () => apiGet<{ pending: number }>('/v1/approvals/count'),
    refetchInterval: 30000,
    retry: false,
  });

  const governanceBadge = approvalCount?.pending ? { '/approvals': approvalCount.pending } : {};

  return (
    <aside className="w-[260px] h-screen bg-surface-sidebar border-r border-[var(--border)] flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-accent flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm font-heading">S</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-text-primary tracking-tight font-heading">SquidJob</h1>
            <p className="text-[10px] text-text-muted -mt-0.5">Mission Control</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        <NavSection label="Main" items={mainNav} />
        <NavSection label="Knowledge" items={knowledgeNav} />
        <NavSection label="Communication" items={commsNav} />
        <NavSection label="Infrastructure" items={infraNav} />
        <NavSection label="Governance" items={governanceNav} badge={governanceBadge} />
        <NavSection label="System" items={systemNav} />
      </nav>

      <div className="px-4 py-3 border-t border-[var(--border)]">
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-accent/10 border border-[var(--border)] flex items-center justify-center shrink-0">
              <span className="text-brand-accent font-semibold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
              <p className="text-xs text-text-muted capitalize">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="text-text-muted hover:text-danger transition-colors p-1 rounded"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
