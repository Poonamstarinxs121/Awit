import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { GitBranch, ChevronDown, ChevronRight, Users, Zap, Award, AlertTriangle, XCircle } from 'lucide-react';
import { apiGet } from '../api/client';

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
  onNavigate,
}: {
  department: string;
  agents: OrgAgent[];
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (id: string) => void;
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
                onClick={() => onNavigate(agent.id)}
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

export function OrgChartPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['org-chart'],
    queryFn: () => apiGet<{ agents: OrgAgent[]; stats: OrgStats }>('/v1/agents/org-chart'),
  });

  const agents = data?.agents || [];
  const stats = data?.stats;
  const tree = buildTree(agents);

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

  return (
    <div>
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
        <div style={{ display: 'flex', gap: '8px' }}>
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
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px', marginBottom: '32px',
        }}>
          {[
            { label: 'Chiefs', value: stats.leads, icon: Award, borderColor: '#FF453A' },
            { label: 'Total Agents', value: stats.total, icon: Users, borderColor: '#0A84FF' },
            { label: 'Active', value: stats.active, icon: Zap, borderColor: '#32D74B' },
            { label: 'Scaffolded', value: stats.idle, icon: AlertTriangle, borderColor: '#FFD60A' },
            { label: 'Deprecated', value: stats.disabled, icon: XCircle, borderColor: '#FF453A' },
          ].map(stat => (
            <div key={stat.label} style={{
              backgroundColor: '#111111',
              border: `1px solid #2A2A2A`,
              borderTop: `2px solid ${stat.borderColor}`,
              borderRadius: '10px', padding: '16px 18px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)', lineHeight: 1, marginBottom: '4px',
              }}>
                {stat.value}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                <stat.icon size={12} color={stat.borderColor} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stat.label}</span>
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
                <ExecutiveCard agent={ceo.agent} isRoot onClick={() => navigate(`/agents/${ceo.agent.id}`)} />

                {coo && (
                  <>
                    <VerticalLine height={24} />
                    <JunctionDot />
                    <VerticalLine height={24} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '32px' }}>
                      <ExecutiveCard agent={coo.agent} onClick={() => navigate(`/agents/${coo.agent.id}`)} />

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
                                  onClick={() => navigate(`/agents/${ga.id}`)}
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
                    <ChiefCard agent={chief.agent} onClick={() => navigate(`/agents/${chief.agent.id}`)} />

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
                                      onNavigate={(id) => navigate(`/agents/${id}`)}
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
                  <ChiefCard key={node.agent.id} agent={node.agent} onClick={() => navigate(`/agents/${node.agent.id}`)} />
                ))}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
