import { useState, useContext, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Brain, Bot, Activity,
  Clock, DollarSign, Settings, History, Search,
  BarChart3, Calendar, Terminal, FileText, Zap,
  Server, ShieldCheck, HelpCircle, CreditCard, Columns3,
  LogOut, Palette, ChevronRight, User,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { ThemeContext, THEMES, type ThemeId } from '../../context/ThemeContext';

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
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useContext(ThemeContext);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: approvalCount } = useQuery({
    queryKey: ['approvals-count'],
    queryFn: () => apiGet<{ pending: number }>('/v1/approvals/count'),
    refetchInterval: 30000,
    retry: false,
  });

  const pendingApprovals = approvalCount?.pending || 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
        setShowThemePicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'SJ';

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
        padding: '8px 0 0 0',
        zIndex: 50,
      }}
    >
      <div style={{ flex: 1, width: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
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
      </div>

      <div style={{ width: '100%', borderTop: '1px solid var(--border)', padding: '8px 0', position: 'relative' }} ref={menuRef}>
        <button
          onClick={() => { setShowUserMenu(!showUserMenu); setShowThemePicker(false); }}
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            padding: '8px 0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-soft)',
            border: '2px solid var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--accent)',
            transition: 'transform 150ms',
          }}>
            {initials}
          </div>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '8px', fontWeight: 500, color: 'var(--text-muted)', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name?.split(' ')[0] || 'Account'}
          </span>
        </button>

        {showUserMenu && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '72px',
            marginBottom: '-50px',
            width: '220px',
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            zIndex: 200,
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name || 'User'}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{user?.email}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>{user?.role}</span>
                {user?.tenantName && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{user.tenantName}</span>}
              </div>
            </div>

            <div style={{ padding: '4px' }}>
              <button
                onClick={() => { setShowThemePicker(!showThemePicker); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: '8px', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px',
                  transition: 'background-color 150ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Palette size={15} />
                  <span>Theme</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{THEMES.find(t => t.id === theme)?.label.split(' ')[0]}</span>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </button>

              <button
                onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '8px', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px',
                  transition: 'background-color 150ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Settings size={15} />
                <span>Settings</span>
              </button>
            </div>

            <div style={{ padding: '4px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { logout(); setShowUserMenu(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '8px', background: 'none', border: 'none',
                  cursor: 'pointer', color: '#FF453A', fontSize: '13px',
                  transition: 'background-color 150ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {showThemePicker && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '296px',
            marginBottom: '-50px',
            width: '200px',
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            zIndex: 201,
            padding: '6px',
          }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 8px 4px' }}>Select Theme</p>
            {THEMES.map((t) => {
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setShowThemePicker(false); setShowUserMenu(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '8px', border: 'none',
                    cursor: 'pointer', fontSize: '12px', fontWeight: isActive ? 600 : 400,
                    backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'background-color 150ms',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'var(--accent-soft)' : 'transparent'; }}
                >
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[t.preview.bg, t.preview.surface, t.preview.accent, t.preview.text].map((c, i) => (
                      <div key={i} style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: c, border: '1px solid rgba(128,128,128,0.2)' }} />
                    ))}
                  </div>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
