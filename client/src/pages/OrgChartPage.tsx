import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch, ChevronDown, ChevronRight, Users, Zap, Award, AlertTriangle,
  XCircle, X, Save, ExternalLink, Server, Monitor, Trash2,
} from 'lucide-react';
import { apiGet, apiPatch } from '../api/client';

interface OrgAgent {
  id: string;
  name: string;
  role: string;
  level: 'intern' | 'specialist' | 'lead';
  status: 'active' | 'idle' | 'error' | 'disabled';
  model_config: Record<string, unknown>;
  manager_id?: string | null;
  job_title?: string | null;
  department?: string | null;
  sort_order?: number;
  skills_count?: number;
  soul_md?: string | null;
}

interface OrgStats {
  total: number;
  active: number;
  idle: number;
  disabled: number;
  leads: number;
  specialists: number;
  interns: number;
}

interface TreeNode {
  agent: OrgAgent;
  children: TreeNode[];
}

interface FleetNode {
  id: string;
  name: string;
  status: string;
  agent_count?: number;
}

interface AgentDetailResponse {
  agent: OrgAgent & { soul_md?: string };
}

function buildTree(agents: OrgAgent[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const a of agents) {
    map.set(a.id, { agent: a, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const a of agents) {
    if (a.manager_id && map.has(a.manager_id)) {
      map.get(a.manager_id)!.children.push(map.get(a.id)!);
    } else {
      roots.push(map.get(a.id)!);
    }
  }
  return roots;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#32D74B',
  idle: '#FFD60A',
  error: '#FF453A',
  disabled: '#636366',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  idle: 'Idle',
  error: 'Error',
  disabled: 'Inactive',
};

const LEVEL_COLORS: Record<string, string> = {
  lead: '#FF453A',
  specialist: '#0A84FF',
  intern: '#32D74B',
};

function getModelLabel(config: Record<string, unknown>): string {
  const m = (config.model as string) || '';
  if (!m) return '';
  const parts = m.split('/');
  const raw = parts[parts.length - 1];
  if (raw.startsWith('claude-')) {
    if (raw.includes('opus')) return 'Opus ' + (raw.match(/[\d.]+$/)?.[0] || '');
    if (raw.includes('sonnet')) return 'Sonnet ' + (raw.match(/[\d.]+$/)?.[0] || '');
    if (raw.includes('haiku')) return 'Haiku ' + (raw.match(/[\d.]+$/)?.[0] || '');
  }
  if (raw.startsWith('gpt-')) return raw.replace('gpt-', 'GPT ');
  if (raw.includes('gemini')) {
    const ver = raw.match(/[\d.]+/)?.[0] || '';
    if (raw.includes('flash')) return 'Gemini Flash' + (ver ? ' ' + ver : '');
    if (raw.includes('pro')) return 'Gemini Pro' + (ver ? ' ' + ver : '');
    return 'Gemini ' + ver;
  }
  if (raw.length > 20) return raw.slice(0, 18) + '…';
  return raw;
}

function isDescendant(agents: OrgAgent[], ancestorId: string, candidateId: string): boolean {
  const childrenOf = new Map<string, string[]>();
  for (const a of agents) {
    if (a.manager_id) {
      if (!childrenOf.has(a.manager_id)) childrenOf.set(a.manager_id, []);
      childrenOf.get(a.manager_id)!.push(a.id);
    }
  }
  const stack = [...(childrenOf.get(ancestorId) || [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === candidateId) return true;
    stack.push(...(childrenOf.get(id) || []));
  }
  return false;
}

function collectAllIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  for (const n of nodes) {
    ids.push(n.agent.id);
    ids.push(...collectAllIds(n.children));
  }
  return ids;
}

function VerticalLine({ height = 24 }: { height?: number }) {
  return <div style={{ width: '2px', height: `${height}px`, backgroundColor: '#333', margin: '0 auto', flexShrink: 0 }} />;
}

function JunctionDot() {
  return (
    <div style={{
      width: '10px', height: '10px', borderRadius: '50%',
      backgroundColor: '#32D74B', border: '2px solid #1a3a2c',
      margin: '0 auto', flexShrink: 0, zIndex: 2,
    }} />
  );
}

function ModelBadge({ config }: { config: Record<string, unknown> }) {
  const label = getModelLabel(config);
  if (!label) return null;
  return (
    <span style={{
      fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
      backgroundColor: '#1E3A5F', color: '#5AC8FA',
      fontFamily: 'var(--font-mono)', fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function SkillsBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span style={{
      fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
      backgroundColor: 'var(--surface-elevated)', color: 'var(--text-muted)',
      fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      Skills ({count})
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#636366';
  const label = STATUS_LABELS[status] || status;
  return (
    <span style={{
      fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
      backgroundColor: color + '1A', color,
      fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: color }} />
      {label}
    </span>
  );
}

function ConnectorHandle({
  position,
  onDragStart,
  agentId,
}: {
  position: 'bottom' | 'top';
  onDragStart: (agentId: string, e: React.MouseEvent) => void;
  agentId: string;
}) {
  return (
    <div
      onMouseDown={(e) => {
        e.stopPropagation();
        onDragStart(agentId, e);
      }}
      title="Drag to connect"
      style={{
        position: 'absolute',
        [position]: '-6px',
        left: '50%', transform: 'translateX(-50%)',
        width: '12px', height: '12px', borderRadius: '50%',
        backgroundColor: '#FF3B30', border: '2px solid #0C0C0C',
        cursor: 'grab', zIndex: 10,
        opacity: 0, transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
    />
  );
}

function AgentCardWrapper({
  children,
  agentId,
  onDragStart,
  onDrop,
  isDragTarget,
  onContextMenu,
}: {
  children: React.ReactNode;
  agentId: string;
  onDragStart: (agentId: string, e: React.MouseEvent) => void;
  onDrop: (targetId: string) => void;
  isDragTarget: boolean;
  onContextMenu: (agentId: string, e: React.MouseEvent) => void;
}) {
  return (
    <div
      data-agent-id={agentId}
      onMouseUp={() => onDrop(agentId)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(agentId, e);
      }}
      style={{
        position: 'relative',
        outline: isDragTarget ? '2px solid #FF3B30' : 'none',
        outlineOffset: '3px',
        borderRadius: '16px',
      }}
      onMouseEnter={e => {
        const handles = e.currentTarget.querySelectorAll('[title="Drag to connect"]') as NodeListOf<HTMLElement>;
        handles.forEach(h => (h.style.opacity = '1'));
      }}
      onMouseLeave={e => {
        const handles = e.currentTarget.querySelectorAll('[title="Drag to connect"]') as NodeListOf<HTMLElement>;
        handles.forEach(h => (h.style.opacity = '0'));
      }}
    >
      <ConnectorHandle position="bottom" onDragStart={onDragStart} agentId={agentId} />
      <ConnectorHandle position="top" onDragStart={onDragStart} agentId={agentId} />
      {children}
    </div>
  );
}

function ExecutiveCard({
  agent,
  isRoot,
  onClick,
}: {
  agent: OrgAgent;
  isRoot?: boolean;
  onClick: () => void;
}) {
  const initials = agent.name.slice(0, 2).toUpperCase();
  const titleColor = isRoot ? '#FFD60A' : '#32D74B';

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#141414',
        border: '1px solid #2A2A2A',
        borderRadius: '16px',
        padding: '20px 24px',
        width: isRoot ? '300px' : '320px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: isRoot
          ? '0 0 20px rgba(255, 214, 10, 0.08), 0 4px 12px rgba(0,0,0,0.4)'
          : '0 4px 12px rgba(0,0,0,0.3)',
        textAlign: 'center',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = titleColor;
        e.currentTarget.style.boxShadow = `0 0 24px ${titleColor}22, 0 4px 16px rgba(0,0,0,0.5)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#2A2A2A';
        e.currentTarget.style.boxShadow = isRoot
          ? '0 0 20px rgba(255, 214, 10, 0.08), 0 4px 12px rgba(0,0,0,0.4)'
          : '0 4px 12px rgba(0,0,0,0.3)';
      }}
    >
      <div style={{
        width: '56px', height: '56px', borderRadius: '50%',
        background: `linear-gradient(135deg, ${titleColor}44, ${titleColor}11)`,
        border: `2px solid ${titleColor}88`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 10px',
        color: titleColor, fontSize: '16px', fontWeight: 800,
        fontFamily: 'var(--font-heading)',
      }}>
        {initials}
      </div>

      {agent.job_title && (
        <div style={{
          fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
          color: titleColor, marginBottom: '4px',
        }}>
          {agent.job_title}
        </div>
      )}

      <div style={{
        fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)',
        fontFamily: 'var(--font-heading)', marginBottom: '4px',
      }}>
        {agent.name}
      </div>

      <div style={{
        fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px',
        lineHeight: 1.4, maxWidth: '260px', margin: '0 auto 12px',
      }}>
        {agent.role}
      </div>

      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <ModelBadge config={agent.model_config} />
        <SkillsBadge count={agent.skills_count || 0} />
      </div>
    </div>
  );
}

function ChiefCard({
  agent,
  onClick,
}: {
  agent: OrgAgent;
  onClick: () => void;
}) {
  const initials = agent.name.slice(0, 2).toUpperCase();
  const color = LEVEL_COLORS[agent.level] || '#0A84FF';

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#141414',
        border: '1px solid #2A2A2A',
        borderRadius: '14px',
        padding: '16px 20px',
        width: '260px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 0 16px ${color}18, 0 2px 12px rgba(0,0,0,0.4)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#2A2A2A';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%',
          background: `linear-gradient(135deg, ${color}44, ${color}11)`,
          border: `2px solid ${color}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, fontSize: '14px', fontWeight: 800,
          fontFamily: 'var(--font-heading)', flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              {agent.name}
            </span>
            <ModelBadge config={agent.model_config} />
          </div>
          {agent.job_title && (
            <div style={{ fontSize: '12px', fontWeight: 600, color, marginTop: '2px' }}>
              {agent.job_title}
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.4 }}>
        {agent.role}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <SkillsBadge count={agent.skills_count || 0} />
      </div>
    </div>
  );
}

function DepartmentSection({
  department,
  agents,
  expanded,
  onToggle,
  onAgentClick,
}: {
  department: string;
  agents: OrgAgent[];
  expanded: boolean;
  onToggle: () => void;
  onAgentClick: (agent: OrgAgent) => void;
}) {
  return (
    <div style={{
      backgroundColor: '#111111',
      border: '1px solid #2A2A2A',
      borderRadius: '12px',
      overflow: 'hidden',
      flex: '1 1 280px',
      minWidth: '280px',
      maxWidth: '400px',
    }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', cursor: 'pointer',
          borderBottom: expanded ? '1px solid #2A2A2A' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {department || 'General'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {agents.length} agent{agents.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '4px 0' }}>
          {agents.map((agent, idx) => {
            const initials = agent.name.charAt(0).toUpperCase();
            const statusColor = STATUS_COLORS[agent.status] || '#636366';
            return (
              <div
                key={agent.id}
                onClick={() => onAgentClick(agent)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 16px', cursor: 'pointer',
                  borderBottom: idx < agents.length - 1 ? '1px solid #1E1E1E' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1A1A1A')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
              >
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  backgroundColor: statusColor + '1A',
                  border: `1.5px solid ${statusColor}66`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: statusColor, fontSize: '11px', fontWeight: 700,
                  fontFamily: 'var(--font-heading)', flexShrink: 0,
                }}>
                  {initials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {agent.name}
                  </div>
                  {agent.job_title && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agent.job_title}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '4px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <StatusBadge status={agent.status} />
                  <ModelBadge config={agent.model_config} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HorizontalConnector({ count }: { count: number }) {
  if (count <= 1) return <VerticalLine height={24} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <VerticalLine height={16} />
      <JunctionDot />
      <div style={{
        height: '2px', backgroundColor: '#333',
        width: `calc(${Math.min(count, 5)} * 276px - 16px)`,
        maxWidth: '100%',
        position: 'relative',
      }} />
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  confirmColor = '#FF3B30',
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmColor?: string;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A',
          borderRadius: '16px', padding: '24px', width: '380px', maxWidth: '90vw',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-heading)' }}>
          {title}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
              backgroundColor: 'transparent', border: '1px solid #2A2A2A',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              backgroundColor: confirmColor, border: 'none',
              color: '#fff', cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContextMenu({
  x,
  y,
  agentName,
  hasManager,
  onRemoveManager,
  onClose,
}: {
  x: number;
  y: number;
  agentName: string;
  hasManager: boolean;
  onRemoveManager: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [onClose]);

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', left: x, top: y, zIndex: 1001,
        backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A',
        borderRadius: '10px', padding: '4px', minWidth: '180px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {agentName}
      </div>
      {hasManager ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveManager();
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            padding: '8px 10px', borderRadius: '6px', border: 'none',
            backgroundColor: 'transparent', color: '#FF453A',
            fontSize: '13px', cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#2A2A2A')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Trash2 size={14} />
          Remove from hierarchy
        </button>
      ) : (
        <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>
          No manager assigned
        </div>
      )}
    </div>
  );
}

function AgentSidePanel({
  agent,
  onClose,
  onSave,
  isSaving,
}: {
  agent: OrgAgent;
  onClose: () => void;
  onSave: (id: string, data: Record<string, unknown>) => void;
  isSaving: boolean;
}) {
  const navigate = useNavigate();
  const [jobTitle, setJobTitle] = useState(agent.job_title || '');
  const [department, setDepartment] = useState(agent.department || '');
  const [level, setLevel] = useState(agent.level);
  const [status, setStatus] = useState(agent.status);
  const [model, setModel] = useState((agent.model_config?.model as string) || '');
  const [provider, setProvider] = useState((agent.model_config?.provider as string) || '');
  const [soulMd, setSoulMd] = useState(agent.soul_md || '');
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: detailData } = useQuery({
    queryKey: ['agent-detail', agent.id],
    queryFn: () => apiGet<AgentDetailResponse>(`/v1/agents/${agent.id}`),
  });

  useEffect(() => {
    if (detailData?.agent?.soul_md && !soulMd) {
      setSoulMd(detailData.agent.soul_md);
    }
  }, [detailData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    const updates: Record<string, unknown> = {};
    if (jobTitle !== (agent.job_title || '')) updates.job_title = jobTitle || null;
    if (department !== (agent.department || '')) updates.department = department || null;
    if (level !== agent.level) updates.level = level;
    if (status !== agent.status) updates.status = status;
    if (model !== ((agent.model_config?.model as string) || '') || provider !== ((agent.model_config?.provider as string) || '')) {
      updates.model_config = { ...agent.model_config, model, provider };
    }
    if (soulMd !== (agent.soul_md || '')) updates.soul_md = soulMd;
    if (Object.keys(updates).length > 0) {
      onSave(agent.id, updates);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '8px',
    backgroundColor: '#111', border: '1px solid #2A2A2A',
    color: 'var(--text-primary)', fontSize: '13px',
    fontFamily: 'var(--font-body)',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block',
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 900,
        }}
      />
      <div
        ref={panelRef}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '400px', maxWidth: '100vw',
          backgroundColor: '#0C0C0C', borderLeft: '1px solid #2A2A2A',
          zIndex: 901, overflowY: 'auto',
          animation: 'slideInRight 0.2s ease-out',
        }}
      >
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2A2A2A' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              {agent.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{agent.role}</div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => navigate(`/agents/${agent.id}`)}
              title="View Full Profile"
              style={{
                width: '32px', height: '32px', borderRadius: '8px',
                backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-muted)',
              }}
            >
              <ExternalLink size={14} />
            </button>
            <button
              onClick={onClose}
              style={{
                width: '32px', height: '32px', borderRadius: '8px',
                backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-muted)',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <StatusBadge status={agent.status} />
            <ModelBadge config={agent.model_config} />
            <SkillsBadge count={agent.skills_count || 0} />
          </div>

          <div>
            <label style={labelStyle}>Job Title</label>
            <input
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g. CTO, Lead Engineer"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Department</label>
            <input
              value={department}
              onChange={e => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Content"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Level</label>
              <select
                value={level}
                onChange={e => setLevel(e.target.value as OrgAgent['level'])}
                style={{ ...inputStyle, appearance: 'auto' }}
              >
                <option value="lead">Lead</option>
                <option value="specialist">Specialist</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as OrgAgent['status'])}
                style={{ ...inputStyle, appearance: 'auto' }}
              >
                <option value="active">Active</option>
                <option value="idle">Scaffolded</option>
                <option value="disabled">Deprecated</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Provider</label>
              <input
                value={provider}
                onChange={e => setProvider(e.target.value)}
                placeholder="openai, anthropic..."
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Model</label>
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="gpt-4o, claude-3..."
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Soul MD</label>
            <textarea
              value={soulMd}
              onChange={e => setSoulMd(e.target.value)}
              placeholder="Agent identity and personality..."
              rows={8}
              style={{
                ...inputStyle,
                resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '12px',
                lineHeight: 1.5, minHeight: '120px',
              }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '10px 16px', borderRadius: '10px', border: 'none',
              backgroundColor: '#FF3B30', color: '#fff',
              fontSize: '13px', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

export function OrgChartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string>('hub');
  const [selectedAgent, setSelectedAgent] = useState<OrgAgent | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [confirmConnect, setConfirmConnect] = useState<{ sourceId: string; targetId: string; sourceName: string; targetName: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; agentId: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ agentId: string; agentName: string } | null>(null);
  const [dragLine, setDragLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const { data: nodesData } = useQuery({
    queryKey: ['fleet-nodes'],
    queryFn: () => apiGet<{ nodes: FleetNode[] }>('/v1/nodes'),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['org-chart', selectedNode],
    queryFn: () => {
      if (selectedNode === 'hub') {
        return apiGet<{ agents: OrgAgent[]; stats: OrgStats }>('/v1/agents/org-chart');
      }
      return apiGet<{ node: { id: string }; heartbeats?: Array<{ agent_statuses?: Array<{ id: string; name: string; status: string }> }> }>(`/v1/nodes/${selectedNode}`).then(nd => {
        const heartbeats = nd.heartbeats || [];
        const latest = heartbeats[0];
        const agentStatuses = latest?.agent_statuses || [];
        const agents: OrgAgent[] = agentStatuses.map((a: Record<string, unknown>) => ({
          id: (a.id as string) || crypto.randomUUID(),
          name: (a.name as string) || 'Unknown',
          role: (a.role as string) || '',
          level: (a.level as OrgAgent['level']) || 'specialist',
          status: (a.status as OrgAgent['status']) || 'idle',
          model_config: (a.model_config as Record<string, unknown>) || {},
          manager_id: (a.manager_id as string) || null,
          job_title: (a.job_title as string) || null,
          department: (a.department as string) || null,
          skills_count: 0,
        }));
        const stats: OrgStats = {
          total: agents.length,
          active: agents.filter(a => a.status === 'active').length,
          idle: agents.filter(a => a.status === 'idle').length,
          disabled: agents.filter(a => a.status === 'disabled').length,
          leads: agents.filter(a => a.level === 'lead').length,
          specialists: agents.filter(a => a.level === 'specialist').length,
          interns: agents.filter(a => a.level === 'intern').length,
        };
        return { agents, stats };
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      apiPatch(`/v1/agents/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-chart'] });
      queryClient.invalidateQueries({ queryKey: ['agent-detail'] });
    },
  });

  const agents = data?.agents || [];
  const stats = data?.stats;
  const tree = buildTree(agents);

  const agentMap = useMemo(() => {
    const m = new Map<string, OrgAgent>();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  const handleExpandAll = () => {
    setExpanded(new Set(collectAllIds(tree)));
    const deptKeys = new Set<string>();
    for (const chief of chiefs) {
      const deptGroups = new Map<string, boolean>();
      for (const child of chief.children) {
        deptGroups.set(child.agent.department || '', true);
      }
      for (const dept of deptGroups.keys()) {
        deptKeys.add(chief.agent.id + ':' + dept);
      }
    }
    setExpandedDepts(deptKeys);
  };

  const handleCollapseAll = () => {
    setExpanded(new Set());
    setExpandedDepts(new Set());
  };

  const toggleNode = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDept = (key: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleDragStart = useCallback((agentId: string, e: React.MouseEvent) => {
    if (selectedNode !== 'hub') return;
    setDragSource(agentId);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    setDragLine({ x1: startX, y1: startY, x2: e.clientX, y2: e.clientY });

    const handleMove = (me: MouseEvent) => {
      setDragLine(prev => prev ? { ...prev, x2: me.clientX, y2: me.clientY } : null);
      const el = document.elementFromPoint(me.clientX, me.clientY);
      const agentCard = el?.closest('[data-agent-id]');
      if (agentCard) {
        setDragTarget(agentCard.getAttribute('data-agent-id'));
      } else {
        setDragTarget(null);
      }
    };

    const handleUp = (me: MouseEvent) => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      setDragLine(null);

      const el = document.elementFromPoint(me.clientX, me.clientY);
      const agentCard = el?.closest('[data-agent-id]');
      const targetId = agentCard?.getAttribute('data-agent-id');

      if (targetId && targetId !== agentId) {
        const source = agentMap.get(agentId);
        const target = agentMap.get(targetId);
        if (source && target) {
          setConfirmConnect({
            sourceId: agentId,
            targetId,
            sourceName: source.name,
            targetName: target.name,
          });
        }
      }

      setDragSource(null);
      setDragTarget(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [agentMap]);

  const handleDrop = useCallback((_targetId: string) => {
  }, []);

  const handleContextMenu = useCallback((agentId: string, e: React.MouseEvent) => {
    setContextMenu({ x: e.clientX, y: e.clientY, agentId });
  }, []);

  const handleConfirmConnect = () => {
    if (confirmConnect) {
      if (isDescendant(agents, confirmConnect.sourceId, confirmConnect.targetId)) {
        alert('Cannot create a cycle: the target agent is a descendant of the source agent.');
        setConfirmConnect(null);
        return;
      }
      updateMutation.mutate({
        id: confirmConnect.sourceId,
        updates: { manager_id: confirmConnect.targetId },
      });
      setConfirmConnect(null);
    }
  };

  const handleRemoveManager = (agentId: string) => {
    updateMutation.mutate({ id: agentId, updates: { manager_id: null } });
    setContextMenu(null);
    setConfirmRemove(null);
  };

  const handleAgentClick = (agent: OrgAgent) => {
    if (selectedNode === 'hub') {
      setSelectedAgent(agent);
    } else {
      navigate(`/agents/${agent.id}`);
    }
  };

  const handleSaveAgent = (id: string, updates: Record<string, unknown>) => {
    updateMutation.mutate({ id, updates }, {
      onSuccess: () => {
        setSelectedAgent(null);
      },
    });
  };

  const rootNodes = tree;
  const ceo = rootNodes.length === 1 ? rootNodes[0] : null;
  const coo = ceo && ceo.children.length === 1 ? ceo.children[0] : null;

  const chiefs = useMemo(() => {
    if (coo) {
      const chiefNodes = coo.children.filter(c => c.children.length > 0 || c.agent.level === 'lead');
      return chiefNodes.length > 0 ? chiefNodes : coo.children;
    }
    if (ceo) return ceo.children;
    return tree;
  }, [ceo, coo, tree]);

  const directReports = useMemo(() => {
    if (coo) {
      const chiefIds = new Set(chiefs.map(c => c.agent.id));
      return coo.children.filter(c => !chiefIds.has(c.agent.id));
    }
    return [];
  }, [coo, chiefs]);

  const groupedDirectReports = useMemo(() => {
    const groups = new Map<string, OrgAgent[]>();
    for (const dr of directReports) {
      const dept = dr.agent.department || 'Direct Reports';
      if (!groups.has(dept)) groups.set(dept, []);
      groups.get(dept)!.push(dr.agent);
    }
    return groups;
  }, [directReports]);

  const nodes = nodesData?.nodes || [];
  const isHubView = selectedNode === 'hub';

  return (
    <div ref={chartRef}>
      {dragLine && (
        <svg
          style={{
            position: 'fixed', inset: 0, width: '100vw', height: '100vh',
            pointerEvents: 'none', zIndex: 999,
          }}
        >
          <line
            x1={dragLine.x1} y1={dragLine.y1}
            x2={dragLine.x2} y2={dragLine.y2}
            stroke="#FF3B30" strokeWidth="2" strokeDasharray="6,4"
          />
          <circle cx={dragLine.x2} cy={dragLine.y2} r="5" fill="#FF3B30" />
        </svg>
      )}

      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <GitBranch size={28} color="var(--text-primary)" />
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '2px' }}>
              Organization Chart
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Operational Structure
              <span style={{ color: 'var(--text-muted)', opacity: 0.5, marginLeft: '8px' }}>Live from config</span>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            backgroundColor: '#111', border: '1px solid #2A2A2A',
            borderRadius: '8px', padding: '4px',
          }}>
            <button
              onClick={() => setSelectedNode('hub')}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                backgroundColor: isHubView ? '#1A1A1A' : 'transparent',
                border: isHubView ? '1px solid #2A2A2A' : '1px solid transparent',
                color: isHubView ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <Server size={12} />
              Hub
            </button>
            {nodes.map(node => (
              <button
                key={node.id}
                onClick={() => setSelectedNode(node.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                  backgroundColor: selectedNode === node.id ? '#1A1A1A' : 'transparent',
                  border: selectedNode === node.id ? '1px solid #2A2A2A' : '1px solid transparent',
                  color: selectedNode === node.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <Monitor size={12} />
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  backgroundColor: node.status === 'online' ? '#32D74B' : node.status === 'degraded' ? '#FFD60A' : '#636366',
                }} />
                {node.name}
              </button>
            ))}
          </div>
          <button
            onClick={handleExpandAll}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
              backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
              backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Collapse All
          </button>
        </div>
      </div>

      {stats && (
        <div style={{
          display: 'flex', marginBottom: '28px',
          border: '1px solid #2A2A2A', borderRadius: '10px', overflow: 'hidden',
        }}>
          {[
            { label: 'Chiefs', value: stats.leads, icon: Award, borderColor: '#FF453A' },
            { label: 'Total Agents', value: stats.total, icon: Users, borderColor: '#0A84FF' },
            { label: 'Active', value: stats.active, icon: Zap, borderColor: '#32D74B' },
            { label: 'Scaffolded', value: stats.idle, icon: AlertTriangle, borderColor: '#FFD60A' },
            { label: 'Deprecated', value: stats.disabled, icon: XCircle, borderColor: '#FF453A' },
          ].map((stat, idx) => (
            <div key={stat.label} style={{
              flex: 1, padding: '12px 16px', textAlign: 'center',
              borderTop: `2px solid ${stat.borderColor}`,
              borderRight: idx < 4 ? '1px solid #2A2A2A' : 'none',
              backgroundColor: '#111111',
            }}>
              <div style={{
                fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)', lineHeight: 1, marginBottom: '2px',
              }}>
                {stat.value}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                <stat.icon size={11} color={stat.borderColor} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stat.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #2A2A2A', borderTopColor: '#FF3B30', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          Loading org chart…
        </div>
      )}

      {isError && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
          Failed to load org chart
        </div>
      )}

      {!isLoading && !isError && agents.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <GitBranch size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No agents configured</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Create agents to build your org chart</div>
        </div>
      )}

      {!isLoading && !isError && agents.length > 0 && (
        <div style={{ overflowX: 'auto', paddingBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 'max-content', padding: '0 20px' }}>

            {ceo && (
              <>
                <AgentCardWrapper
                  agentId={ceo.agent.id}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  isDragTarget={dragTarget === ceo.agent.id && dragSource !== ceo.agent.id}
                  onContextMenu={handleContextMenu}
                >
                  <ExecutiveCard agent={ceo.agent} isRoot onClick={() => handleAgentClick(ceo.agent)} />
                </AgentCardWrapper>

                {coo && (
                  <>
                    <VerticalLine height={24} />
                    <JunctionDot />
                    <VerticalLine height={24} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '32px' }}>
                      <AgentCardWrapper
                        agentId={coo.agent.id}
                        onDragStart={handleDragStart}
                        onDrop={handleDrop}
                        isDragTarget={dragTarget === coo.agent.id && dragSource !== coo.agent.id}
                        onContextMenu={handleContextMenu}
                      >
                        <ExecutiveCard agent={coo.agent} onClick={() => handleAgentClick(coo.agent)} />
                      </AgentCardWrapper>

                      {groupedDirectReports.size > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px' }}>
                          {Array.from(groupedDirectReports.entries()).map(([groupName, groupAgents]) => (
                            <div key={groupName} style={{
                              backgroundColor: '#111111', border: '1px solid #2A2A2A',
                              borderRadius: '12px', padding: '12px', minWidth: '200px', maxWidth: '240px',
                            }}>
                              <div style={{
                                fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                                color: '#32D74B', marginBottom: '4px',
                              }}>
                                DIRECT TO {coo.agent.job_title || coo.agent.name}
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                {groupName}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                {groupAgents.length} agent{groupAgents.length !== 1 ? 's' : ''}
                              </div>
                              {groupAgents.map(ga => (
                                <div
                                  key={ga.id}
                                  onClick={() => handleAgentClick(ga)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '6px 0', cursor: 'pointer',
                                    borderTop: '1px solid #1E1E1E',
                                  }}
                                >
                                  <span style={{
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    backgroundColor: STATUS_COLORS[ga.status] || '#636366',
                                    flexShrink: 0,
                                  }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {ga.name}
                                    </div>
                                    {ga.job_title && (
                                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ga.job_title}</div>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                                    <StatusBadge status={ga.status} />
                                    <ModelBadge config={ga.model_config} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {chiefs.length > 0 && <HorizontalConnector count={chiefs.length} />}
                  </>
                )}

                {!coo && chiefs.length > 0 && <HorizontalConnector count={chiefs.length} />}
              </>
            )}

            {!ceo && tree.length > 0 && (
              <div style={{ marginBottom: '16px' }} />
            )}

            {chiefs.length > 0 && (
              <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap' }}>
                {chiefs.map(chief => (
                  <div key={chief.agent.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <VerticalLine height={16} />
                    <AgentCardWrapper
                      agentId={chief.agent.id}
                      onDragStart={handleDragStart}
                      onDrop={handleDrop}
                      isDragTarget={dragTarget === chief.agent.id && dragSource !== chief.agent.id}
                      onContextMenu={handleContextMenu}
                    >
                      <ChiefCard agent={chief.agent} onClick={() => handleAgentClick(chief.agent)} />
                    </AgentCardWrapper>

                    {chief.children.length > 0 && (
                      <>
                        <div style={{ marginTop: '8px', marginBottom: '0' }}>
                          <button
                            onClick={() => toggleNode(chief.agent.id)}
                            style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              backgroundColor: '#1A1A1A', border: '1px solid #333',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: 'var(--text-muted)',
                            }}
                          >
                            {expanded.has(chief.agent.id)
                              ? <ChevronDown size={12} />
                              : <ChevronRight size={12} />
                            }
                          </button>
                        </div>

                        {expanded.has(chief.agent.id) && (
                          <div style={{ marginTop: '8px', width: '100%' }}>
                            {(() => {
                              const deptGroups = new Map<string, OrgAgent[]>();
                              for (const child of chief.children) {
                                const dept = child.agent.department || '';
                                if (!deptGroups.has(dept)) deptGroups.set(dept, []);
                                deptGroups.get(dept)!.push(child.agent);
                                for (const gc of child.children) {
                                  if (!deptGroups.has(dept)) deptGroups.set(dept, []);
                                  deptGroups.get(dept)!.push(gc.agent);
                                }
                              }

                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {Array.from(deptGroups.entries()).map(([dept, deptAgents]) => (
                                    <DepartmentSection
                                      key={dept || '__none'}
                                      department={dept}
                                      agents={deptAgents}
                                      expanded={expandedDepts.has(chief.agent.id + ':' + dept)}
                                      onToggle={() => toggleDept(chief.agent.id + ':' + dept)}
                                      onAgentClick={handleAgentClick}
                                    />
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!ceo && !coo && chiefs.length === 0 && tree.length > 0 && (
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {tree.map(node => (
                  <AgentCardWrapper
                    key={node.agent.id}
                    agentId={node.agent.id}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    isDragTarget={dragTarget === node.agent.id && dragSource !== node.agent.id}
                    onContextMenu={handleContextMenu}
                  >
                    <ChiefCard agent={node.agent} onClick={() => handleAgentClick(node.agent)} />
                  </AgentCardWrapper>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {confirmConnect && (
        <ConfirmModal
          title="Connect Agents"
          message={`Set "${confirmConnect.sourceName}" to report to "${confirmConnect.targetName}"?`}
          confirmLabel="Connect"
          onConfirm={handleConfirmConnect}
          onCancel={() => setConfirmConnect(null)}
        />
      )}

      {confirmRemove && (
        <ConfirmModal
          title="Remove from Hierarchy"
          message={`Remove "${confirmRemove.agentName}" from the hierarchy? This agent will become a root node.`}
          confirmLabel="Remove"
          onConfirm={() => handleRemoveManager(confirmRemove.agentId)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          agentName={agentMap.get(contextMenu.agentId)?.name || ''}
          hasManager={!!agentMap.get(contextMenu.agentId)?.manager_id}
          onRemoveManager={() => {
            const agent = agentMap.get(contextMenu.agentId);
            if (agent) {
              setConfirmRemove({ agentId: agent.id, agentName: agent.name });
              setContextMenu(null);
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {selectedAgent && isHubView && (
        <AgentSidePanel
          key={selectedAgent.id}
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onSave={handleSaveAgent}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
