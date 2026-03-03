'use client';

import { useEffect, useState } from 'react';

interface Stats {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  uptime_seconds: number;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function StatusBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [hubConnected, setHubConnected] = useState(false);

  useEffect(() => {
    const fetchStats = () => {
      fetch('/api/system/stats')
        .then(r => r.json())
        .then(setStats)
        .catch(() => {});
    };
    const fetchHub = () => {
      fetch('/api/hub/status')
        .then(r => r.json())
        .then(d => setHubConnected(d.configured))
        .catch(() => {});
    };
    fetchStats();
    fetchHub();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const metricStyle = (val: number) => ({
    color: val > 85 ? 'var(--negative)' : val > 60 ? 'var(--warning)' : 'var(--positive)',
  });

  return (
    <footer style={{
      position: 'fixed',
      bottom: 0,
      left: 68,
      right: 0,
      height: 32,
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)',
      zIndex: 99,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: hubConnected ? 'var(--positive)' : 'var(--text-muted)',
          display: 'inline-block',
        }} />
        <span>{hubConnected ? 'Hub Connected' : 'Standalone'}</span>
      </div>

      {stats && (
        <div style={{ display: 'flex', gap: 16 }}>
          <span>CPU <span style={metricStyle(stats.cpu_percent)}>{stats.cpu_percent}%</span></span>
          <span>RAM <span style={metricStyle(stats.memory_percent)}>{stats.memory_percent}%</span></span>
          <span>DSK <span style={metricStyle(stats.disk_percent)}>{stats.disk_percent}%</span></span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {stats && <span>UP {formatUptime(stats.uptime_seconds)}</span>}
        <span>v0.1.0</span>
      </div>
    </footer>
  );
}
