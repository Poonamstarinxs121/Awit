import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { Badge } from './ui/Badge';
import { NotificationBell } from './NotificationBell';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/kanban': 'Mission Queue',
  '/agents': 'Agents',
  '/standups': 'Standups',
  '/settings': 'Settings',
  '/documents': 'Documents',
  '/memory-graph': 'Memory Graph',
  '/squad-chat': 'Squad Chat',
  '/help': 'Help Center',
  '/subscription': 'Subscription',
};

export function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || '';

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border-default bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-text-primary">{pageTitle}</h2>
            {user?.tenantName && (
              <span className="text-xs text-text-muted">{user.tenantName}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <Badge variant="info">{user.role}</Badge>
                <NotificationBell />
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
