import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Columns3, Users, Clock, Settings, LogOut, HelpCircle, FileText, MessageSquare, Brain, Server } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const mainNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/kanban', label: 'Mission Queue', icon: Columns3 },
  { to: '/agents', label: 'Agents', icon: Users },
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

const systemNav = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/help', label: 'Help Center', icon: HelpCircle },
];

function NavSection({ label, items }: { label: string; items: typeof mainNav }) {
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
                ? 'bg-brand-accent/10 text-brand-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-light'
            }`
          }
        >
          <item.icon size={18} />
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-[260px] h-screen bg-surface-sidebar border-r border-border-default flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-border-default">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">SquidJob</h1>
            <p className="text-[10px] text-text-muted -mt-0.5">Mission Control</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        <NavSection label="Main" items={mainNav} />
        <NavSection label="Knowledge" items={knowledgeNav} />
        <NavSection label="Communication" items={commsNav} />
        <NavSection label="Infrastructure" items={infraNav} />
        <NavSection label="System" items={systemNav} />
      </nav>

      <div className="px-4 py-3 border-t border-border-default">
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-accent/20 flex items-center justify-center shrink-0">
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
              className="text-text-muted hover:text-danger transition-colors p-1"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
