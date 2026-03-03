'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Cpu,
  Bot,
  MessageSquare,
  Activity,
  Clock,
  Brain,
  FolderOpen,
  DollarSign,
  Puzzle,
  Box,
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/system', icon: Cpu, label: 'System' },
  { href: '/agents', icon: Bot, label: 'Agents' },
  { href: '/sessions', icon: MessageSquare, label: 'Sessions' },
  { href: '/activity', icon: Activity, label: 'Activity' },
  { href: '/cron', icon: Clock, label: 'Cron' },
  { href: '/memory', icon: Brain, label: 'Memory' },
  { href: '/files', icon: FolderOpen, label: 'Files' },
  { href: '/costs', icon: DollarSign, label: 'Costs' },
  { href: '/skills', icon: Puzzle, label: 'Skills' },
  { href: '/office', icon: Box, label: 'Office' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Dock() {
  const pathname = usePathname();

  return (
    <nav style={{
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      width: 68,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 56,
      gap: 2,
      zIndex: 100,
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {NAV_ITEMS.map(item => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 10,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon size={20} />
          </Link>
        );
      })}
    </nav>
  );
}
