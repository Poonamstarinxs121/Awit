import { useEffect, useState } from 'react';
import { Monitor, Cpu, HardDrive, MemoryStick, Activity, Server, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatsCard } from '../components/ui/StatsCard';
import { apiGet } from '../api/client';

interface SystemStats {
  cpu: number;
  ram: { used: number; total: number };
  disk: { used: number; total: number };
  uptime: string;
  loadAvg: number[];
  agents: { total: number; online: number };
  tasks: { active: number };
  cronJobs: { total: number };
  vpnActive: boolean;
  firewallActive: boolean;
}

interface ServiceItem {
  name: string;
  label: string;
  status: string;
  description: string;
  pid?: number | null;
  mem?: number | null;
  uptime?: number | null;
  restarts?: number;
}

export function SystemMonitor() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [sysStats, svcData] = await Promise.all([
        apiGet<SystemStats>('/v1/system/stats'),
        apiGet<{ services: ServiceItem[] }>('/v1/system/services'),
      ]);
      setStats(sysStats);
      setServices(svcData.services || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 10000);
    return () => clearInterval(interval);
  }, []);

  const BarMeter = ({ value, max, color }: { value: number; max: number; color: string }) => {
    const pct = Math.min(100, (value / Math.max(max, 0.1)) * 100);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '40px', textAlign: 'right' }}>
          {pct.toFixed(0)}%
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '300px', color: 'var(--text-muted)' }}>
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            System Monitor
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Real-time platform health and resource usage
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatsCard title="CPU Usage" value={`${stats?.cpu || 0}%`} icon={<Cpu size={18} />} iconColor={stats && stats.cpu > 80 ? 'var(--negative)' : 'var(--info)'} />
        <StatsCard title="RAM Used" value={`${stats?.ram.used || 0}GB`} icon={<MemoryStick size={18} />} iconColor="var(--type-command)" />
        <StatsCard title="System Uptime" value={stats?.uptime || '–'} icon={<Activity size={18} />} iconColor="var(--positive)" />
        <StatsCard title="Active Agents" value={`${stats?.agents.online || 0}/${stats?.agents.total || 0}`} icon={<Server size={18} />} iconColor="var(--accent)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <SectionHeader title="Resource Usage" />
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'CPU', icon: Cpu, value: stats?.cpu || 0, max: 100, unit: '%', color: stats && stats.cpu > 80 ? 'var(--negative)' : 'var(--info)' },
              { label: 'Memory', icon: MemoryStick, value: stats?.ram.used || 0, max: stats?.ram.total || 1, unit: 'GB', color: 'var(--type-command)' },
            ].map(({ label, icon: Icon, value, max, unit, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                  <div className="flex items-center gap-2">
                    <Icon size={14} style={{ color }} />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {value}{unit} / {max}{unit}
                  </span>
                </div>
                <BarMeter value={value} max={max} color={color} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <SectionHeader title="Platform Stats" />
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Total Agents', value: stats?.agents.total || 0, color: 'var(--accent)' },
              { label: 'Online Agents', value: stats?.agents.online || 0, color: 'var(--positive)' },
              { label: 'Active Tasks', value: stats?.tasks.active || 0, color: 'var(--info)' },
              { label: 'Cron Jobs', value: stats?.cronJobs.total || 0, color: 'var(--type-cron)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color, fontFamily: 'var(--font-heading)' }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <SectionHeader title="Services" />
        <div>
          {services.map((svc, i) => (
            <div
              key={svc.name}
              className="flex items-center gap-4"
              style={{ padding: '14px 20px', borderBottom: i < services.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              {svc.status === 'active' ? (
                <CheckCircle size={16} style={{ color: 'var(--positive)', flexShrink: 0 }} />
              ) : (
                <XCircle size={16} style={{ color: 'var(--negative)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{svc.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{svc.description}</div>
              </div>
              <div className="flex items-center gap-3">
                {svc.pid && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PID {svc.pid}</span>}
                {svc.mem && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{svc.mem}MB</span>}
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', backgroundColor: svc.status === 'active' ? 'var(--positive-soft)' : 'var(--negative-soft)', color: svc.status === 'active' ? 'var(--positive)' : 'var(--negative)' }}>
                  {svc.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
