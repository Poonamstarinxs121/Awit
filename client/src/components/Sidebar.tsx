import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Columns3, Users, Clock, Settings } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/kanban', label: 'Mission Queue', icon: Columns3 },
  { to: '/agents', label: 'Agents', icon: Users },
  { to: '/standups', label: 'Standups', icon: Clock },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-[260px] h-screen bg-surface-sidebar border-r border-gray-800 flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white tracking-tight">
          <span className="text-brand-accent">Squid</span>Job
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Mission Control</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-accent/10 text-brand-accent'
                  : 'text-gray-400 hover:text-white hover:bg-surface-light'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800">
        <p className="text-xs text-gray-600">v1.0.0</p>
      </div>
    </aside>
  );
}
