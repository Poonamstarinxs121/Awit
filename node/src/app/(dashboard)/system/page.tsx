'use client';

import { useEffect, useState } from 'react';
import { Cpu, HardDrive, MemoryStick, Clock, Monitor, Server } from 'lucide-react';

interface SystemStats {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  uptime_seconds: number;
  hostname: string;
  platform: string;
  arch: string;
  total_memory_gb: number;
  free_memory_gb: number;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(' ');
}

function GaugeBar({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  const barColor = value > 85 ? '#EF4444' : value > 60 ? '#F59E0B' : color;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Icon size={18} style={{ color: barColor }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: barColor }}>
          {value}%
        </span>
      </div>
      <div style={{
        width: '100%',
        height: 8,
        borderRadius: 4,
        background: 'var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${value}%`,
          height: '100%',
          borderRadius: 4,
          background: barColor,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

export default function SystemPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    const fetchStats = () => {
      fetch('/api/system/stats').then(r => r.json()).then(setStats).catch(() => {});
    };
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading system stats...</div>;
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, marginBottom: 20 }}>
        System Monitor
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <GaugeBar label="CPU" value={stats.cpu_percent} icon={Cpu} color="#3B82F6" />
        <GaugeBar label="Memory" value={stats.memory_percent} icon={MemoryStick} color="#8B5CF6" />
        <GaugeBar label="Disk" value={stats.disk_percent} icon={HardDrive} color="#F59E0B" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: 'var(--font-heading)' }}>
            System Info
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <InfoRow icon={Monitor} label="Hostname" value={stats.hostname} />
            <InfoRow icon={Server} label="Platform" value={`${stats.platform} / ${stats.arch}`} />
            <InfoRow icon={MemoryStick} label="Total RAM" value={`${stats.total_memory_gb} GB`} />
            <InfoRow icon={MemoryStick} label="Free RAM" value={`${stats.free_memory_gb} GB`} />
            <InfoRow icon={Clock} label="Uptime" value={formatUptime(stats.uptime_seconds)} />
          </div>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: 'var(--font-heading)' }}>
            OpenClaw Gateway
          </h2>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Gateway status monitoring available when OpenClaw is running on port 18789.
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Icon size={14} style={{ color: 'var(--text-muted)' }} />
      <span style={{ color: 'var(--text-secondary)', width: 100 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
