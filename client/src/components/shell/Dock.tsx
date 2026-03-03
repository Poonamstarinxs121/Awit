import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Brain, Bot, Activity,
  Clock, DollarSign, Settings, History, Search,
  BarChart3, Calendar, Terminal, FileText, Zap,
  Server, ShieldCheck, HelpCircle, CreditCard, Columns3,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';

const dockSections = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/system', label: 'System', icon: Monitor },
      { href: '/agents', label: 'Agents', icon: Bot },
      { href: '/sessions', label: 'Sessions', icon: History },
      { href: '/activity', label: 'Activity', icon: Activity },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/costs', label: 'Costs', icon: DollarSign },
      { href: '/memory', label: 'Memory', icon: Brain },
      { href: '/search', label: 'Search', icon: Search },
    ],
  },
  {
    label: 'Automation',
    items: [
      { href: '/automation', label: 'Automation', icon: Zap },
      { href: '/calendar', label: 'Calendar', icon: Calendar },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { href: '/machines', label: 'Machines', icon: Server },
      { href: '/terminal', label: 'Terminal', icon: Terminal },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/boards', label: 'Boards', icon: Columns3 },
      { href: '/documents', label: 'Docs', icon: FileText },
      { href: '/standups', label: 'Standups', icon: Clock },
      { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/subscription', label: 'Billing', icon: CreditCard },
      { href: '/help', label: 'Help', icon: HelpCircle },
    ],
  },
];

export function Dock() {
  const location = useLocation();

  const { data: approvalCount } = useQuery({
    queryKey: ['approvals-count'],
    queryFn: () => apiGet<{ pending: number }>('/v1/approvals/count'),
    refetchInterval: 30000,
    retry: false,
  });

  const pendingApprovals = approvalCount?.pending || 0;

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: '68px',
        backgroundColor: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
        gap: '0',
        zIndex: 50,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {dockSections.map((section, si) => (
        <div key={section.label} style={{ width: '100%' }}>
          {si > 0 && (
            <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 10px' }} />
          )}
          {section.items.map((item) => {
            const isActive = item.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.href);
            const Icon = item.icon;
            const hasBadge = item.href === '/approvals' && pendingApprovals > 0;

            return (
              <NavLink
                key={item.href}
                to={item.href}
                className="group relative"
                style={{
                  width: '100%',
                  height: '52px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                  textDecoration: 'none',
                  position: 'relative',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ position: 'relative' }}>
                  <Icon
                    style={{
                      width: '18px',
                      height: '18px',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      strokeWidth: isActive ? 2.5 : 2,
                    }}
                  />
                  {hasBadge && (
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      width: '12px',
                      height: '12px',
                      backgroundColor: 'var(--accent)',
                      borderRadius: '50%',
                      fontSize: '8px',
                      fontWeight: 700,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {pendingApprovals > 9 ? '9' : pendingApprovals}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '8px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
                <span
                  className="pointer-events-none opacity-0 group-hover:opacity-100"
                  style={{
                    position: 'absolute',
                    left: '72px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    zIndex: 100,
                    transition: 'opacity 150ms ease',
                    pointerEvents: 'none',
                  }}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
