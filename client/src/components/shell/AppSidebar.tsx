import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Activity, Layers, Columns3, Tag, ShieldCheck,
  Bot, Zap, Building2, Network, ChevronDown, ChevronRight,
  Users, HelpCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';

const SIDEBAR_W = 220;

const STATUS_DOT: Record<string, string> = {
  active:   '#30D158',
  idle:     '#FFD60A',
  error:    '#FF453A',
  disabled: '#636366',
};

interface Agent {
  id: string;
  name: string;
  role: string;
  level: string;
  status: string;
}

type WorkspaceMode = 'personal' | 'organisation';

const NAV_SECTIONS = [
  {
    label: 'Navigation',
    items: [
      { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
      { href: '/activity',  label: 'Live Feed',  icon: Activity },
    ],
  },
  {
    label: 'Boards',
    items: [
      { href: '/boards',    label: 'Board Groups', icon: Layers },
      { href: '/kanban',    label: 'Boards',       icon: Columns3 },
      { href: '/approvals', label: 'Approvals',    icon: ShieldCheck },
    ],
  },
  {
    label: 'Skills',
    items: [
      { href: '/agents',     label: 'Agents',     icon: Bot },
      { href: '/automation', label: 'Automation', icon: Zap },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/organisation', label: 'Organisation', icon: Building2 },
      { href: '/machines',     label: 'Machines',     icon: Network },
      { href: '/help',         label: 'Help',         icon: HelpCircle },
    ],
  },
];

export function AppSidebar({ dockWidth }: { dockWidth: number }) {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<WorkspaceMode>('personal');
  const [wsOpen, setWsOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV_SECTIONS.forEach(s => { init[s.label] = true; });
    return init;
  });
  const wsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setWsOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiGet<{ agents: Agent[] }>('/v1/agents'),
    refetchInterval: 30000,
  });
  const agents = agentsData?.agents ?? [];

  const toggleSection = (label: string) =>
    setOpenSections(p => ({ ...p, [label]: !p[label] }));

  return (
    <div style={{
      position: 'fixed',
      left: `${dockWidth}px`,
      top: 0,
      bottom: 0,
      width: `${SIDEBAR_W}px`,
      backgroundColor: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 40,
      transition: 'left 220ms cubic-bezier(0.4,0,0.2,1)',
      overflowX: 'hidden',
    }}>

      {/* Workspace switcher */}
      <div style={{
        height: '48px', flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 12px', borderBottom: '1px solid var(--border)',
        position: 'relative',
      }} ref={wsRef}>
        <button
          onClick={() => setWsOpen(p => !p)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px', borderRadius: '8px', cursor: 'pointer',
            backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
            transition: 'background-color 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--card)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Users size={13} style={{ color: 'var(--text-muted)' }} />
            <span>{workspace === 'personal' ? 'Personal' : 'Organisation'}</span>
          </div>
          <ChevronDown size={13} style={{ color: 'var(--text-muted)', transform: wsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
        </button>

        {wsOpen && (
          <div style={{
            position: 'absolute', top: '46px', left: '12px', right: '12px', zIndex: 60,
            backgroundColor: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '4px',
          }}>
            {(['personal', 'organisation'] as WorkspaceMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setWorkspace(m); setWsOpen(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '7px',
                  border: 'none', cursor: 'pointer', fontSize: '13px',
                  backgroundColor: workspace === m ? 'var(--accent-soft)' : 'transparent',
                  color: workspace === m ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: workspace === m ? 600 : 400,
                  transition: 'background-color 150ms',
                }}
                onMouseEnter={e => { if (workspace !== m) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                onMouseLeave={e => { if (workspace !== m) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {m === 'personal' ? 'Personal Workspace' : 'Organisation'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav sections */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 0' }}>
        {NAV_SECTIONS.map((section, si) => {
          const isOpen = openSections[section.label] !== false;
          return (
            <div key={section.label}>
              {si > 0 && (
                <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 14px' }} />
              )}

              {/* Section header */}
              <button
                onClick={() => toggleSection(section.label)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 14px 3px', border: 'none', background: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                  {section.label}
                </span>
                <ChevronDown size={11} style={{
                  transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 200ms',
                }} />
              </button>

              {/* Items */}
              {isOpen && section.items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className="app-sidebar-link"
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: '9px',
                      padding: '7px 14px',
                      margin: '1px 6px',
                      borderRadius: '8px', textDecoration: 'none',
                      borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                      backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: '13px', fontWeight: isActive ? 600 : 400,
                      transition: 'background-color 150ms, color 150ms',
                    })}
                  >
                    <Icon size={15} strokeWidth={1.9} style={{ flexShrink: 0, color: 'inherit' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  </NavLink>
                );
              })}
              <div style={{ height: '2px' }} />
            </div>
          );
        })}

        {/* Agents list */}
        {agents.length > 0 && (
          <>
            <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 14px 4px' }} />
            <div style={{ padding: '8px 14px 3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                Agents
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', backgroundColor: 'var(--surface-elevated)', padding: '1px 6px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                {agents.length}
              </span>
            </div>
            {agents.slice(0, 12).map(agent => (
              <button
                key={agent.id}
                onClick={() => navigate(`/agents/${agent.id}`)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '5px 14px', border: 'none', background: 'none', cursor: 'pointer',
                  borderRadius: '0', textAlign: 'left', transition: 'background-color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    backgroundColor: 'var(--accent-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700, color: 'var(--accent)',
                  }}>
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{
                    position: 'absolute', bottom: '-1px', right: '-1px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: STATUS_DOT[agent.status] || STATUS_DOT.disabled,
                    border: '1.5px solid var(--surface)',
                  }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                    {agent.name}
                  </p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, textTransform: 'capitalize' }}>
                    {agent.role || agent.level}
                  </p>
                </div>
              </button>
            ))}
            {agents.length > 12 && (
              <button
                onClick={() => navigate('/agents')}
                style={{ width: '100%', padding: '5px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--accent)', textAlign: 'left' }}
              >
                +{agents.length - 12} more agents →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export const APP_SIDEBAR_W = SIDEBAR_W;
