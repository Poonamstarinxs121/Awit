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
    memory_total_gb?: number;
    memory_used_gb?: number;
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

  const totalMemGb = onlineMachines.length > 0
    ? onlineMachines.reduce((s, m) => s + (m.memory_total_gb || 16), 0) / onlineMachines.length
    : null;
  const usedMemGb = totalMemGb && avgMem !== null ? (avgMem / 100) * totalMemGb : null;

  function getBarColor(value: number): string {
    if (value < 50) return '#32D74B';
    if (value < 80) return '#FFD60A';
    return '#FF453A';
  }

  function MiniBar({ value, label, suffix }: { value: number; label: string; suffix?: string }) {
    const color = getBarColor(value);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
        <span style={{ fontSize: '10px', fontWeight: 600, color, fontFamily: 'var(--font-mono)' }}>{suffix || `${value}%`}</span>
        <div style={{ width: '48px', height: '4px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', backgroundColor: color, borderRadius: '2px', transition: 'width 300ms' }} />
        </div>
      </div>
    );
  }

  function StatusIndicator({ label, active }: { label: string; active: boolean }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: active ? '#32D74B' : '#FF453A',
        }} />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      </div>
    );
  }

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
            backgroundColor: connected ? '#32D74B' : '#FF453A',
            boxShadow: connected ? '0 0 6px rgba(50,215,75,0.5)' : '0 0 6px rgba(255,69,58,0.5)',
          }} />
        </div>

        {(avgCpu !== null || avgMem !== null || avgDisk !== null) && (
          <>
            {avgCpu !== null && <MiniBar value={avgCpu} label="CPU" />}
            {avgMem !== null && (
              <MiniBar
                value={avgMem}
                label="RAM"
                suffix={usedMemGb !== null && totalMemGb !== null
                  ? `${usedMemGb.toFixed(1)}/${totalMemGb.toFixed(0)}GB`
                  : `${avgMem}%`}
              />
            )}
            {avgDisk !== null && <MiniBar value={avgDisk} label="DISK" />}
            <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border)' }} />
          </>
        )}

        <StatusIndicator label="VPN" active={false} />
        <StatusIndicator label="UFW" active={true} />

        {totalMachines > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>SVC:</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: onlineMachines.length === totalMachines ? '#32D74B' : '#FFD60A', fontFamily: 'var(--font-mono)' }}>
              {onlineMachines.length}/{totalMachines}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Uptime:</span>
          <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{uptime}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {stats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>agents:</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#32D74B', fontFamily: 'var(--font-mono)' }}>{stats.agents?.online || 0}/{stats.agents?.total || 0}</span>
          </div>
        )}
        {user?.tenantName && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {user.tenantName}
          </span>
        )}
      </div>
    </div>
  );
}
