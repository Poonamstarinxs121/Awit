import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

interface SystemStats {
  agents: { total: number; online: number };
  tasks: { active: number };
}

export function StatusBar() {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: stats } = useQuery({
    queryKey: ['status-bar-stats'],
    queryFn: async () => {
      try {
        const [sysStats, health] = await Promise.all([
          apiGet<SystemStats>('/v1/system/stats'),
          apiGet<{ status: string }>('/v1/health'),
        ]);
        setConnected(health.status === 'ok');
        return sysStats;
      } catch {
        setConnected(false);
        return null;
      }
    },
    refetchInterval: 10000,
    retry: false,
  });

  const { data: taskCount } = useQuery({
    queryKey: ['status-bar-tasks'],
    queryFn: () => apiGet<{ tasks: any[] }>('/v1/tasks?status=in_progress&limit=1'),
    refetchInterval: 15000,
    retry: false,
  });

  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const Metric = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
    <div className="flex items-center gap-1.5" style={{ height: '24px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {label}:
      </span>
      <span style={{ fontSize: '11px', fontWeight: 600, color: color || 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: '68px',
        right: 0,
        height: '32px',
        backgroundColor: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 45,
        gap: '16px',
      }}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: connected ? 'var(--positive)' : 'var(--negative)',
          }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {connected ? 'connected' : 'disconnected'}
          </span>
        </div>

        {stats && (
          <>
            <Metric label="agents" value={`${stats.agents?.online || 0}/${stats.agents?.total || 0}`} color="var(--positive)" />
            <Metric label="active" value={stats.tasks?.active || 0} color="var(--info)" />
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {user?.tenantName && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {user.tenantName}
          </span>
        )}
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {dateStr} · {timeStr}
        </span>
      </div>
    </div>
  );
}
