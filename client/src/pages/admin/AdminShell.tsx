import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, TrendingUp, ReceiptText,
  LogOut, ChevronLeft, ChevronRight, Bell, Building2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Platform',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Tenants',
    items: [
      { href: '/admin/tenants', label: 'All Tenants', icon: Building2 },
      { href: '/admin/plans', label: 'Subscription Plans', icon: CreditCard },
    ],
  },
  {
    title: 'Finance',
    items: [
      { href: '/admin/finance', label: 'Revenue & MRR', icon: TrendingUp },
      { href: '/admin/subscriptions', label: 'Subscriptions', icon: ReceiptText },
    ],
  },
];

export function AdminShell({ children, title }: { children: React.ReactNode; title: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const sidebarW = collapsed ? 60 : 220;
  const initials = user?.email?.slice(0, 2).toUpperCase() || 'SA';

  const isActive = (href: string) => {
    if (href === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(href);
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0C0C0C', fontFamily: 'var(--font-body)' }}>
      <aside style={{
        width: `${sidebarW}px`, minHeight: '100vh', flexShrink: 0,
        backgroundColor: '#111111', borderRight: '1px solid #2A2A2A',
        display: 'flex', flexDirection: 'column', transition: 'width 200ms ease',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, overflow: 'hidden',
      }}>
        <div style={{ padding: collapsed ? '16px 0' : '16px 20px', borderBottom: '1px solid #2A2A2A', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', minHeight: '60px' }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <span style={{ fontSize: '22px', flexShrink: 0 }}>🦑</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>SquidJob</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Admin Console</p>
              </div>
            </div>
          )}
          {collapsed && <span style={{ fontSize: '22px' }}>🦑</span>}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #2A2A2A', backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.title} style={{ marginBottom: '8px' }}>
              {!collapsed && (
                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 16px 4px' }}>
                  {section.title}
                </p>
              )}
              {section.items.map(item => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: collapsed ? '10px 0' : '9px 16px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      backgroundColor: active ? 'rgba(255,59,48,0.08)' : 'transparent',
                      borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                      fontSize: '13px', fontWeight: active ? 600 : 400,
                      textDecoration: 'none', transition: 'all 120ms',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                  >
                    <item.icon size={15} style={{ flexShrink: 0, color: active ? 'var(--accent)' : 'inherit' }} />
                    {!collapsed && item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid #2A2A2A', padding: collapsed ? '12px 0' : '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: collapsed ? 'center' : 'flex-start', marginBottom: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
              {initials}
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
                <p style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>Super Admin</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', padding: '7px 4px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', transition: 'all 120ms' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#FF453A'; e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut size={13} />
            {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, marginLeft: `${sidebarW}px`, transition: 'margin-left 200ms ease', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header style={{ height: '48px', backgroundColor: '#111111', borderBottom: '1px solid #2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', position: 'sticky', top: 0, zIndex: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span>Admin</span>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#32D74B', fontWeight: 500 }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#32D74B' }} />
              Online
            </div>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Bell size={16} />
            </button>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>
              {initials}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
