import { useState, useContext, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Brain, Bot, Activity,
  Clock, DollarSign, Settings, History, Search,
  BarChart3, Calendar, Terminal, FileText, Zap,
  Server, ShieldCheck, HelpCircle, CreditCard, Columns3, PieChart,
  LogOut, Palette, ChevronRight, Building2, ChevronDown,
  ChevronLeft, Store, Package, Box, Wifi, X, GitBranch,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { ThemeContext, THEMES } from '../../context/ThemeContext';

const DOCK_EXPANDED_KEY = 'squidjob_dock_expanded';

const DOCK_COLLAPSED_W = 68;
const DOCK_EXPANDED_W = 240;
const MOBILE_BREAKPOINT = 768;

const dockSections = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/system',    label: 'System',    icon: Monitor },
      { href: '/agents',    label: 'Agents',    icon: Bot },
      { href: '/sessions',  label: 'Sessions',  icon: History },
      { href: '/activity',  label: 'Activity',  icon: Activity },
      { href: '/office',    label: 'Office',    icon: Box },
      { href: '/org-chart', label: 'Org Chart', icon: GitBranch },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/costs',     label: 'Costs',     icon: DollarSign },
      { href: '/memory',    label: 'Memory',    icon: Brain },
      { href: '/search',    label: 'Search',    icon: Search },
      { href: '/fleet-analytics', label: 'Fleet Analytics', icon: PieChart },
      { href: '/fleet-office', label: 'Fleet Office', icon: Building2 },
    ],
  },
  {
    label: 'Automation',
    items: [
      { href: '/automation', label: 'Automation', icon: Zap },
      { href: '/calendar',   label: 'Calendar',   icon: Calendar },
    ],
  },
  {
    label: 'Skills',
    items: [
      { href: '/marketplace', label: 'Marketplace', icon: Store },
      { href: '/packs',       label: 'Packs',       icon: Package },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { href: '/fleet',    label: 'Fleet',    icon: Wifi },
      { href: '/servers', label: 'Servers', icon: Server },
      { href: '/terminal', label: 'Terminal', icon: Terminal },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/kanban',    label: 'Boards',    icon: Columns3 },
      { href: '/documents', label: 'Documents', icon: FileText },
      { href: '/standups',  label: 'Standups',  icon: Clock },
      { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/organisation', label: 'Organisation', icon: Building2 },
      { href: '/settings',     label: 'Settings',     icon: Settings },
      { href: '/subscription', label: 'Billing',      icon: CreditCard },
      { href: '/help',         label: 'Help',         icon: HelpCircle },
    ],
  },
];

export function getDockWidth(): number {
  if (typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT) {
    return 0;
  }
  try {
    return localStorage.getItem(DOCK_EXPANDED_KEY) === 'true' ? DOCK_EXPANDED_W : DOCK_COLLAPSED_W;
  } catch { return DOCK_COLLAPSED_W; }
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

export function Dock() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useContext(ThemeContext);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem(DOCK_EXPANDED_KEY) === 'true'; }
    catch { return false; }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setMobileOpen(prev => !prev);
    window.addEventListener('toggle-mobile-dock', handler);
    return () => window.removeEventListener('toggle-mobile-dock', handler);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
    window.dispatchEvent(new Event('dock-resize'));
  }, [isMobile, location.pathname]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    dockSections.forEach(s => { init[s.label] = true; });
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
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
        setShowThemePicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U';

  const showExpanded = isMobile ? true : expanded;
  const dockW = isMobile ? DOCK_EXPANDED_W : (expanded ? DOCK_EXPANDED_W : DOCK_COLLAPSED_W);

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  const handleNavClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  if (isMobile && !mobileOpen) {
    return null;
  }

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          className="dock-backdrop visible"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside style={{
        position: 'fixed', left: 0, top: 0, bottom: 0,
        width: `${dockW}px`,
        backgroundColor: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        zIndex: 50, transition: isMobile ? 'transform 220ms cubic-bezier(0.4,0,0.2,1)' : 'width 220ms cubic-bezier(0.4,0,0.2,1)',
        overflow: 'visible',
        ...(isMobile ? {
          transform: mobileOpen ? 'translateX(0)' : `translateX(-${dockW}px)`,
          boxShadow: mobileOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
        } : {}),
      }}>

        {!isMobile && (
          <button
            onClick={toggleExpanded}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              position: 'absolute', right: '-12px', top: '50%',
              transform: 'translateY(-50%)',
              width: '20px', height: '44px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: 'none',
              borderRadius: '0 8px 8px 0',
              cursor: 'pointer', zIndex: 51,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
              transition: 'background-color 150ms, color 150ms',
              boxShadow: '2px 0 8px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'var(--surface)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {expanded ? <ChevronLeft size={11} strokeWidth={2.5} /> : <ChevronRight size={11} strokeWidth={2.5} />}
          </button>
        )}

        {/* Header */}
        <div style={{
          height: '48px', flexShrink: 0,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: showExpanded ? '0 16px' : '0',
          borderBottom: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {showExpanded ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🦑</span>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px', lineHeight: 1 }}>
                  SquidJob
                </div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.8px', textTransform: 'uppercase', marginTop: '2px' }}>
                  Mission Control
                </div>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: '20px', margin: '0 auto' }}>🦑</span>
          )}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav sections */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: '6px', paddingBottom: '4px' }}>
          {dockSections.map((section, si) => {
            const isOpen = openSections[section.label] !== false;
            const sectionActive = section.items.some(i => isActive(i.href));

            return (
              <div key={section.label} style={{ marginBottom: '2px' }}>
                {si > 0 && (
                  <div style={{
                    height: '1px',
                    backgroundColor: 'var(--border)',
                    margin: showExpanded ? '6px 14px 6px' : '5px 12px 5px',
                  }} />
                )}

                {showExpanded && (
                  <button
                    onClick={() => toggleSection(section.label)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 16px 4px 14px',
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: sectionActive ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = sectionActive ? 'var(--accent)' : 'var(--text-muted)'; }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase' }}>
                      {section.label}
                    </span>
                    <ChevronDown size={11} style={{
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 200ms',
                    }} />
                  </button>
                )}

                {(showExpanded ? isOpen : true) && section.items.map(item => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const hasBadge = item.href === '/approvals' && pendingApprovals > 0;

                  if (showExpanded) {
                    return (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={handleNavClick}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '7px 12px 7px 16px',
                          margin: '1px 6px',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                          color: active ? 'var(--accent)' : 'var(--text-secondary)',
                          fontSize: '13px', fontWeight: active ? 600 : 400,
                          transition: 'background-color 150ms, color 150ms',
                          position: 'relative',
                        }}
                        onMouseEnter={e => {
                          if (!active) {
                            e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!active) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }
                        }}
                      >
                        {active && (
                          <div style={{
                            position: 'absolute', left: 0, top: '20%', bottom: '20%',
                            width: '3px', borderRadius: '0 2px 2px 0',
                            backgroundColor: 'var(--accent)',
                          }} />
                        )}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <Icon size={16} strokeWidth={active ? 2.2 : 1.8}
                            style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }} />
                          {hasBadge && (
                            <span style={{
                              position: 'absolute', top: '-4px', right: '-6px',
                              width: '14px', height: '14px',
                              backgroundColor: 'var(--accent)', borderRadius: '50%',
                              fontSize: '8px', fontWeight: 700, color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: '1.5px solid var(--surface)',
                            }}>{pendingApprovals > 9 ? '9+' : pendingApprovals}</span>
                          )}
                        </div>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>
                      </NavLink>
                    );
                  }

                  return (
                    <div key={item.href} style={{ position: 'relative' }} className="group">
                      <NavLink
                        to={item.href}
                        onClick={handleNavClick}
                        style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: '3px',
                          height: '46px', width: '100%',
                          textDecoration: 'none',
                          backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                          position: 'relative',
                          transition: 'background-color 150ms',
                          borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                        }}
                        onMouseEnter={e => {
                          if (!active) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
                        }}
                        onMouseLeave={e => {
                          if (!active) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ position: 'relative' }}>
                          <Icon size={18} strokeWidth={active ? 2.3 : 1.9}
                            style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }} />
                          {hasBadge && (
                            <span style={{
                              position: 'absolute', top: '-4px', right: '-5px',
                              width: '12px', height: '12px',
                              backgroundColor: 'var(--accent)', borderRadius: '50%',
                              fontSize: '7px', fontWeight: 700, color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>{pendingApprovals > 9 ? '9' : pendingApprovals}</span>
                          )}
                        </div>
                        <span style={{
                          fontSize: '9px', fontWeight: active ? 600 : 500,
                          color: active ? 'var(--accent)' : 'var(--text-muted)',
                          textAlign: 'center', whiteSpace: 'nowrap', letterSpacing: '0.1px',
                        }}>
                          {item.label}
                        </span>
                      </NavLink>

                      <span className="pointer-events-none opacity-0 group-hover:opacity-100" style={{
                        position: 'absolute', left: `${DOCK_COLLAPSED_W + 6}px`, top: '50%',
                        transform: 'translateY(-50%)',
                        padding: '5px 10px', borderRadius: '7px',
                        fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap',
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        zIndex: 200,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                        transition: 'opacity 120ms ease',
                        pointerEvents: 'none',
                      }}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User menu */}
        <div ref={menuRef} style={{
          flexShrink: 0, borderTop: '1px solid var(--border)',
          padding: '8px 0 10px', position: 'relative',
        }}>
          <button
            onClick={() => { setShowUserMenu(p => !p); setShowThemePicker(false); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: showExpanded ? 'flex-start' : 'center',
              gap: '10px', padding: showExpanded ? '6px 14px' : '8px 0',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              backgroundColor: 'var(--accent)', opacity: 0.85,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: '#fff', userSelect: 'none',
            }}>{initial}</div>
            {showExpanded && (
              <div style={{ minWidth: 0, textAlign: 'left' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name || user?.email?.split('@')[0] || 'User'}
                </p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.role} · {user?.tenantName}
                </p>
              </div>
            )}
          </button>

          {showUserMenu && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 8px)',
              left: showExpanded ? '8px' : `${DOCK_COLLAPSED_W + 8}px`,
              width: '240px',
              backgroundColor: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '14px', boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
              overflow: 'hidden', zIndex: 200,
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    backgroundColor: 'var(--accent)', opacity: 0.85,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>{initial}</div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.email}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    {user?.role}
                  </span>
                  {user?.tenantName && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.tenantName}</span>
                  )}
                </div>
              </div>

              <div style={{ padding: '6px' }}>
                <MenuRow icon={<Palette size={15} />} label="Theme"
                  right={<><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{THEMES.find(t => t.id === theme)?.label}</span><ChevronRight size={13} style={{ color: 'var(--text-muted)' }} /></>}
                  onClick={() => setShowThemePicker(p => !p)} />
                <MenuRow icon={<Settings size={15} />} label="Preferences"
                  onClick={() => { navigate('/settings'); setShowUserMenu(false); if (isMobile) setMobileOpen(false); }} />
              </div>

              <div style={{ padding: '6px', borderTop: '1px solid var(--border)' }}>
                <MenuRow icon={<LogOut size={15} />} label="Sign Out" danger
                  onClick={() => { logout(); setShowUserMenu(false); }} />
              </div>
            </div>
          )}

          {showThemePicker && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 8px)',
              left: showExpanded ? '256px' : `${DOCK_COLLAPSED_W + 256}px`,
              width: '210px',
              backgroundColor: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '14px', boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
              overflow: 'hidden', zIndex: 201, padding: '6px',
              ...(isMobile ? { left: '8px', bottom: 'calc(100% + 60px)' } : {}),
            }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '6px 10px 4px' }}>
                Select Theme
              </p>
              {THEMES.map(t => {
                const active = theme === t.id;
                return (
                  <button key={t.id}
                    onClick={() => { setTheme(t.id); setShowThemePicker(false); setShowUserMenu(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      fontSize: '12px', fontWeight: active ? 600 : 400,
                      backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      transition: 'background-color 150ms',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = active ? 'var(--accent-soft)' : 'transparent'; }}
                  >
                    <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                      {[t.preview.bg, t.preview.surface, t.preview.accent, t.preview.text].map((c, i) => (
                        <div key={i} style={{ width: '13px', height: '13px', borderRadius: '3px', backgroundColor: c, border: '1px solid rgba(128,128,128,0.15)' }} />
                      ))}
                    </div>
                    <span>{t.label}</span>
                    {active && <span style={{ marginLeft: 'auto', fontSize: '16px' }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function MenuRow({ icon, label, right, onClick, danger }: {
  icon: React.ReactNode; label: string; right?: React.ReactNode;
  onClick?: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px', padding: '9px 12px',
        borderRadius: '8px', border: 'none', cursor: 'pointer',
        color: danger ? '#FF453A' : 'var(--text-secondary)',
        fontSize: '13px', background: 'none',
        transition: 'background-color 150ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = danger ? 'rgba(255,69,58,0.08)' : 'var(--surface-elevated)'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {icon}
        <span>{label}</span>
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{right}</div>}
    </button>
  );
}
