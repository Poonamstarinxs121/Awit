import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

interface SystemStats {
  agents: { total: number; online: number };
  tasks: { active: number };
}

interface MachineHealth {
  machines: Array<{
    id: string;
    status: string;
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
  }>;
}

export function StatusBar() {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const [connected, setConnected] = useState(true);
  const [uptime, setUptime] = useState('0m');

  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => {
      setTime(new Date());
      const elapsed = Date.now() - start;
      const mins = Math.floor(elapsed / 60000);
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);
      if (days > 0) setUptime(`${days}d ${hrs % 24}h`);
      else if (hrs > 0) setUptime(`${hrs}h ${mins % 60}m`);
      else setUptime(`${mins}m`);
    }, 1000);
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

  const { data: machineData } = useQuery({
    queryKey: ['status-bar-machines'],
    queryFn: async () => {
      try {
        return await apiGet<MachineHealth>('/v1/machines');
      } catch {
        return null;
      }
    },
    refetchInterval: 30000,
    retry: false,
  });

  const machines = machineData?.machines ?? [];
  const onlineMachines = machines.filter(m => m.status === 'online');
  const totalMachines = machines.length;

  const avgCpu = onlineMachines.length > 0
    ? Math.round(onlineMachines.reduce((s, m) => s + (m.cpu_usage || 0), 0) / onlineMachines.length)
    : null;
  const avgMem = onlineMachines.length > 0
    ? Math.round(onlineMachines.reduce((s, m) => s + (m.memory_usage || 0), 0) / onlineMachines.length)
    : null;
  const avgDisk = onlineMachines.length > 0
    ? Math.round(onlineMachines.reduce((s, m) => s + (m.disk_usage || 0), 0) / onlineMachines.length)
    : null;

  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  function getBarColor(value: number): string {
    if (value < 50) return 'var(--positive)';
    if (value < 80) return 'var(--warning)';
    return 'var(--negative)';
  }

  function MiniBar({ value, label }: { value: number; label: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '24px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '28px' }}>{label}</span>
        <span style={{ fontSize: '10px', fontWeight: 600, color: getBarColor(value), fontFamily: 'var(--font-mono)', minWidth: '24px' }}>{value}%</span>
        <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${value}%`, height: '100%', backgroundColor: getBarColor(value), borderRadius: '2px', transition: 'width 300ms' }} />
        </div>
      </div>
    );
  }

  const Metric = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '24px' }}>
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}:</span>
      <span style={{ fontSize: '10px', fontWeight: 600, color: color || 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
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
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: connected ? 'var(--positive)' : 'var(--negative)',
            boxShadow: connected ? '0 0 4px var(--positive)' : '0 0 4px var(--negative)',
          }} />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {connected ? 'connected' : 'disconnected'}
          </span>
        </div>

        {stats && (
          <>
            <Metric label="agents" value={`${stats.agents?.online || 0}/${stats.agents?.total || 0}`} color="var(--positive)" />
            <Metric label="active" value={stats.tasks?.active || 0} color="var(--info)" />
          </>
        )}

        {totalMachines > 0 && (
          <>
            <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border)' }} />
            {avgCpu !== null && <MiniBar value={avgCpu} label="CPU" />}
            {avgMem !== null && <MiniBar value={avgMem} label="RAM" />}
            {avgDisk !== null && <MiniBar value={avgDisk} label="DSK" />}
            <Metric label="SVC" value={`${onlineMachines.length}/${totalMachines}`} color={onlineMachines.length === totalMachines ? 'var(--positive)' : 'var(--warning)'} />
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <Metric label="Uptime" value={uptime} />
        {user?.tenantName && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {user.tenantName}
          </span>
        )}
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {dateStr} · {timeStr}
        </span>
      </div>
    </div>
  );
}
