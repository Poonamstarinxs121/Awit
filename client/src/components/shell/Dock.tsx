import { useState, useContext, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Brain, Bot, Activity,
  Clock, DollarSign, Settings, History, Search,
  BarChart3, Calendar, Terminal, FileText, Zap,
  Server, ShieldCheck, HelpCircle, CreditCard, Columns3,
  LogOut, Palette, ChevronRight, Building2, ChevronDown,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { ThemeContext, THEMES, type ThemeId } from '../../context/ThemeContext';

const DOCK_EXPANDED_KEY = 'squidjob_dock_expanded';

const dockSections = [
  {
    label: 'Core',
    defaultOpen: true,
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
    defaultOpen: true,
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/costs', label: 'Costs', icon: DollarSign },
      { href: '/memory', label: 'Memory', icon: Brain },
      { href: '/search', label: 'Search', icon: Search },
    ],
  },
  {
    label: 'Automation',
    defaultOpen: true,
    items: [
      { href: '/automation', label: 'Automation', icon: Zap },
      { href: '/calendar', label: 'Calendar', icon: Calendar },
    ],
  },
  {
    label: 'Infrastructure',
    defaultOpen: true,
    items: [
      { href: '/machines', label: 'Machines', icon: Server },
      { href: '/terminal', label: 'Terminal', icon: Terminal },
    ],
  },
  {
    label: 'Workspace',
    defaultOpen: true,
    items: [
      { href: '/boards', label: 'Boards', icon: Columns3 },
      { href: '/documents', label: 'Documents', icon: FileText },
      { href: '/standups', label: 'Standups', icon: Clock },
      { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
    ],
  },
  {
    label: 'System',
    defaultOpen: true,
    items: [
      { href: '/organisation', label: 'Organisation', icon: Building2 },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/subscription', label: 'Billing', icon: CreditCard },
      { href: '/help', label: 'Help', icon: HelpCircle },
    ],
  },
];

export function getDockWidth(): number {
  try {
    return localStorage.getItem(DOCK_EXPANDED_KEY) === 'true' ? 220 : 68;
  } catch { return 68; }
}

export function Dock() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useContext(ThemeContext);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem(DOCK_EXPANDED_KEY) === 'true'; }
    catch { return false; }
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    dockSections.forEach(s => { init[s.label] = s.defaultOpen; });
    return init;
  });

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem(DOCK_EXPANDED_KEY, String(next)); } catch {}
    window.dispatchEvent(new Event('dock-resize'));
  };

  const toggleSection = (label: string) => {
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

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

  const initial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U';

  const dockWidth = expanded ? 220 : 68;

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${dockWidth}px`,
        backgroundColor: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        transition: 'width 200ms ease',
        overflow: 'hidden',
      }}
    >
      <div style={{
        height: '48px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: expanded ? 'space-between' : 'center',
        padding: expanded ? '0 12px 0 16px' : '0',
        borderBottom: '1px solid var(--border)',
      }}>
        {expanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>🦑</span>
            <span style={{
              fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700,
              color: 'var(--text-primary)', letterSpacing: '-0.3px', whiteSpace: 'nowrap',
            }}>SquidJob</span>
          </div>
        )}
        <button
          onClick={toggleExpanded}
          style={{
            width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '6px', border: 'none', cursor: 'pointer',
            backgroundColor: 'transparent', color: 'var(--text-muted)',
            transition: 'background-color 150ms, color 150ms',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: expanded ? '4px 0' : '4px 0' }}>
        {dockSections.map((section, si) => {
          const isOpen = openSections[section.label] !== false;
          const hasActiveChild = section.items.some(item =>
            item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href)
          );

          return (
            <div key={section.label}>
              {si > 0 && (
                <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: expanded ? '4px 12px' : '4px 10px' }} />
              )}

              {expanded ? (
                <>
                  <button
                    onClick={() => toggleSection(section.label)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 14px', border: 'none', background: 'none', cursor: 'pointer',
                      color: hasActiveChild ? 'var(--accent)' : 'var(--text-muted)',
                      transition: 'color 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = hasActiveChild ? 'var(--accent)' : 'var(--text-muted)'; }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      {section.label}
                    </span>
                    <ChevronDown
                      size={12}
                      style={{
                        transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 200ms',
                        color: 'inherit',
                      }}
                    />
                  </button>

                  {isOpen && section.items.map(item => {
                    const isActive = item.href === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.href);
                    const Icon = item.icon;
                    const hasBadge = item.href === '/approvals' && pendingApprovals > 0;

                    return (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '7px 14px 7px 18px', margin: '1px 6px',
                          borderRadius: '7px', textDecoration: 'none',
                          backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                          fontSize: '13px', fontWeight: isActive ? 600 : 400,
                          transition: 'background-color 150ms, color 150ms',
                          position: 'relative',
                        }}
                        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                      >
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <Icon size={16} style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)', strokeWidth: isActive ? 2.2 : 1.8 }} />
                          {hasBadge && (
                            <span style={{
                              position: 'absolute', top: '-4px', right: '-6px',
                              width: '14px', height: '14px', backgroundColor: 'var(--accent)', borderRadius: '50%',
                              fontSize: '8px', fontWeight: 700, color: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: '1.5px solid var(--surface)',
                            }}>{pendingApprovals > 9 ? '9+' : pendingApprovals}</span>
                          )}
                        </div>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </>
              ) : (
                section.items.map(item => {
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
                        width: '100%', height: '44px',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '2px',
                        backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                        textDecoration: 'none', position: 'relative',
                        transition: 'background-color 150ms ease',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ position: 'relative' }}>
                        <Icon size={17} style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)', strokeWidth: isActive ? 2.5 : 2 }} />
                        {hasBadge && (
                          <span style={{
                            position: 'absolute', top: '-4px', right: '-4px',
                            width: '12px', height: '12px', backgroundColor: 'var(--accent)', borderRadius: '50%',
                            fontSize: '7px', fontWeight: 700, color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{pendingApprovals > 9 ? '9' : pendingApprovals}</span>
                        )}
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: '8px',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                        textAlign: 'center', whiteSpace: 'nowrap',
                      }}>{item.label}</span>
                      <span
                        className="pointer-events-none opacity-0 group-hover:opacity-100"
                        style={{
                          position: 'absolute', left: '72px', top: '50%', transform: 'translateY(-50%)',
                          padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                          whiteSpace: 'nowrap', backgroundColor: 'var(--surface-elevated)',
                          border: '1px solid var(--border)', color: 'var(--text-primary)',
                          zIndex: 100, transition: 'opacity 150ms ease', pointerEvents: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        }}
                      >{item.label}</span>
                    </NavLink>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      <div style={{ width: '100%', position: 'relative', padding: '6px 0 10px', borderTop: '1px solid var(--border)' }} ref={menuRef}>
        <button
          onClick={() => { setShowUserMenu(!showUserMenu); setShowThemePicker(false); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: expanded ? 'flex-start' : 'center',
            gap: '10px', padding: expanded ? '6px 14px' : '6px 0',
            background: 'none', border: 'none', cursor: 'pointer',
            borderRadius: '6px',
          }}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            backgroundColor: '#333',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-heading)', color: '#fff',
            transition: 'opacity 150ms', userSelect: 'none',
          }}>{initial}</div>
          {expanded && (
            <div style={{ minWidth: 0, textAlign: 'left' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'User'}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
            </div>
          )}
        </button>

        {showUserMenu && (
          <div style={{
            position: 'absolute', bottom: '8px',
            left: expanded ? '8px' : '72px',
            width: '240px',
            backgroundColor: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            overflow: 'hidden', zIndex: 200,
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#333',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 600, color: '#fff', flexShrink: 0,
                }}>{initial}</div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'User'}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>{user?.role}</span>
                {user?.tenantName && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{user.tenantName}</span>}
              </div>
            </div>
            <div style={{ padding: '4px' }}>
              <button onClick={() => setShowThemePicker(!showThemePicker)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', transition: 'background-color 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Palette size={15} /><span>Theme</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{THEMES.find(t => t.id === theme)?.label.split(' ')[0]}</span>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </button>
              <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', transition: 'background-color 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <Settings size={15} /><span>Preferences</span>
              </button>
            </div>
            <div style={{ padding: '4px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { logout(); setShowUserMenu(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#FF453A', fontSize: '13px', transition: 'background-color 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <LogOut size={15} /><span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {showThemePicker && (
          <div style={{
            position: 'absolute', bottom: '8px',
            left: expanded ? '252px' : '316px',
            width: '200px', backgroundColor: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: '12px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)', overflow: 'hidden', zIndex: 201, padding: '6px',
          }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 8px 4px' }}>Select Theme</p>
            {THEMES.map(t => {
              const isActive = theme === t.id;
              return (
                <button key={t.id} onClick={() => { setTheme(t.id); setShowThemePicker(false); setShowUserMenu(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: isActive ? 600 : 400, backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent', color: isActive ? 'var(--accent)' : 'var(--text-secondary)', transition: 'background-color 150ms' }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'var(--accent-soft)' : 'transparent'; }}>
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
