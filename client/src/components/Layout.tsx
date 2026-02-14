import { Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { Badge } from './ui/Badge';

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-800 bg-surface-sidebar flex items-center justify-between px-6 shrink-0">
          <div />
          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="text-sm text-gray-300">{user.name}</span>
                <Badge variant="info">{user.role}</Badge>
                <button
                  onClick={logout}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Sign out"
                >
                  <LogOut size={18} />
                </button>
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
