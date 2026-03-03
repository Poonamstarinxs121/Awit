import { useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { NotificationBell } from '../NotificationBell';
import { Badge } from '../ui/Badge';
import { apiPost, apiGet } from '../../api/client';
import { useQuery } from '@tanstack/react-query';

export function TopBar({ dockWidth = 68 }: { dockWidth?: number }) {
  const { user } = useAuth();
  const [globalPaused, setGlobalPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);

  useQuery({
    queryKey: ['pause-status'],
    queryFn: async () => {
      const data = await apiGet<{ globalPaused: boolean }>('/v1/settings/pause-status');
      setGlobalPaused(data.globalPaused);
      return data;
    },
    refetchInterval: 60000,
    retry: false,
  });

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

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'SJ';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: `${dockWidth}px`,
        transition: 'left 200ms ease',
        right: 0,
        height: '48px',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 45,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          style={{
            backgroundColor: 'var(--accent-soft)',
            borderRadius: '4px',
            padding: '2px 8px',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)' }}>
            MISSION CONTROL
          </span>
        </div>
        {globalPaused && (
          <div style={{
            backgroundColor: 'rgba(255, 214, 10, 0.15)',
            border: '1px solid rgba(255, 214, 10, 0.3)',
            borderRadius: '4px',
            padding: '2px 8px',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--warning)' }}>
              ALL AGENTS PAUSED
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <button
              onClick={togglePause}
              disabled={pauseLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid',
                cursor: pauseLoading ? 'not-allowed' : 'pointer',
                opacity: pauseLoading ? 0.6 : 1,
                backgroundColor: globalPaused ? 'rgba(50, 215, 75, 0.1)' : 'rgba(255, 214, 10, 0.1)',
                borderColor: globalPaused ? 'rgba(50, 215, 75, 0.3)' : 'rgba(255, 214, 10, 0.3)',
                color: globalPaused ? 'var(--positive)' : 'var(--warning)',
                transition: 'all 150ms ease',
              }}
            >
              {globalPaused ? (
                <>
                  <svg width="10" height="10" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
                  </svg>
                  Resume
                </>
              ) : (
                <>
                  <svg width="10" height="10" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                  </svg>
                  Pause All
                </>
              )}
            </button>

            {user.role && (
              <Badge variant="info">{user.role}</Badge>
            )}

            <NotificationBell />

            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-soft)',
                border: '1px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--accent)',
                flexShrink: 0,
              }}
              title={user.email}
            >
              {initials}
            </div>

            {user.tenantName && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {user.tenantName}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
