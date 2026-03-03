'use client';

import { usePathname } from 'next/navigation';
import { Settings, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/system': 'System Monitor',
  '/agents': 'Agents',
  '/sessions': 'Sessions',
  '/activity': 'Activity',
  '/cron': 'Cron Jobs',
  '/memory': 'Memory',
  '/files': 'Files',
  '/costs': 'Costs',
  '/skills': 'Skills',
  '/office': 'Office',
  '/settings': 'Settings',
};

export default function TopBar() {
  const pathname = usePathname();
  const [hubConnected, setHubConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/hub/status')
      .then(r => r.json())
      .then(d => setHubConnected(d.configured && d.lastHeartbeat))
      .catch(() => setHubConnected(false));
  }, []);

  const breadcrumb = ROUTE_LABELS[pathname] || pathname.slice(1).replace(/-/g, ' ');

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 68,
      right: 0,
      height: 48,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      zIndex: 99,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🦑</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
          SquidJob Node
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>/</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13, textTransform: 'capitalize' }}>
          {breadcrumb}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div title={hubConnected ? 'Hub connected' : hubConnected === false ? 'Hub not connected' : 'Checking...'}>
          {hubConnected ? (
            <Wifi size={16} style={{ color: 'var(--positive)' }} />
          ) : (
            <WifiOff size={16} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
        <Link href="/settings" style={{ color: 'var(--text-secondary)' }}>
          <Settings size={16} />
        </Link>
      </div>
    </header>
  );
}
