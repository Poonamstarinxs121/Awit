import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { Badge } from './ui/Badge';
import { NotificationBell } from './NotificationBell';
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../api/client';

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
  const [globalPaused, setGlobalPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);

  useEffect(() => {
    apiGet<{ globalPaused: boolean }>('/v1/settings/pause-status')
      .then(data => setGlobalPaused(data.globalPaused))
      .catch(() => {});
  }, []);

  const togglePause = useCallback(async () => {
    setPauseLoading(true);
    try {
      const endpoint = globalPaused ? '/v1/settings/resume-all' : '/v1/settings/pause-all';
      const data = await apiPost<{ globalPaused: boolean }>(endpoint, {});
      setGlobalPaused(data.globalPaused);
    } catch (error) {
      console.error('Failed to toggle pause:', error);
    } finally {
      setPauseLoading(false);
    }
  }, [globalPaused]);

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {globalPaused && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-center">
            <span className="text-amber-800 text-xs font-medium">All agents are paused. Heartbeats and cron jobs are suspended.</span>
          </div>
        )}
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
                <button
                  onClick={togglePause}
                  disabled={pauseLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    globalPaused
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  } ${pauseLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {globalPaused ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" /></svg>
                      RESUME
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" /></svg>
                      PAUSE
                    </>
                  )}
                </button>
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
