import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { Badge } from './ui/Badge';
import { NotificationBell } from './NotificationBell';

export function Layout() {
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-800 bg-surface-sidebar flex items-center justify-between px-6 shrink-0">
          <div className="text-sm text-gray-400">
            {user?.tenantName && (
              <span className="text-gray-300 font-medium">{user.tenantName}</span>
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
