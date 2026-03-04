import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { GitBranch, ChevronDown, ChevronRight, Users, Zap, Award } from 'lucide-react';
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

const LEVEL_COLORS: Record<string, string> = {
  lead: '#FF3B30',
  specialist: '#0A84FF',
  intern: '#32D74B',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#32D74B',
  idle: '#FFD60A',
  error: '#FF3B30',
  disabled: '#636366',
};

function getModel(config: Record<string, unknown>): string {
  const m = (config.model as string) || '';
  if (!m) return '';
  const parts = m.split('/');
  const raw = parts[parts.length - 1];
  if (raw.length > 18) return raw.slice(0, 16) + '…';
  return raw;
}

function AgentNode({
  node,
  expanded,
  onToggle,
  onNavigate,
  depth,
}: {
  node: TreeNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
  depth: number;
}) {
  const { agent, children } = node;
  const isExpanded = expanded.has(agent.id);
  const hasChildren = children.length > 0;
  const initials = agent.name.slice(0, 2).toUpperCase();
  const color = LEVEL_COLORS[agent.level] || '#636366';
  const statusColor = STATUS_COLORS[agent.status] || '#636366';
  const modelStr = getModel(agent.model_config);

  const departmentGroups = new Map<string, TreeNode[]>();
  for (const child of children) {
    const dept = child.agent.department || '';
    if (!departmentGroups.has(dept)) departmentGroups.set(dept, []);
    departmentGroups.get(dept)!.push(child);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {hasChildren && isExpanded && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '2px',
            height: '20px',
            backgroundColor: 'var(--border)',
          }} />
        )}

        <div
          style={{
            backgroundColor: 'var(--card)',
            border: `1px solid var(--border)`,
            borderRadius: '12px',
            padding: '12px 14px',
            minWidth: depth === 0 ? '180px' : '160px',
            maxWidth: '200px',
            cursor: 'pointer',
            position: 'relative',
            transition: 'border-color 0.15s',
            boxShadow: depth === 0 ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          onClick={() => onNavigate(agent.id)}
        >
          <div style={{ position: 'absolute', top: '8px', right: '8px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: statusColor }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: color + '22',
              border: `2px solid ${color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: color, fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-heading)',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {agent.name}
              </div>
              {agent.job_title && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.job_title}
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agent.role}
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '4px', backgroundColor: color + '22', color: color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {agent.level}
            </span>
            {modelStr && (
              <span style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '4px', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {modelStr}
              </span>
            )}
            {(agent.skills_count || 0) > 0 && (
              <span style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '4px', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-muted)' }}>
                {agent.skills_count} skills
              </span>
            )}
          </div>
        </div>

        {hasChildren && (
          <button
            onClick={e => { e.stopPropagation(); onToggle(agent.id); }}
            style={{
              marginTop: '4px',
              width: '20px', height: '20px',
              borderRadius: '50%',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)',
              zIndex: 1,
            }}
          >
            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ width: '2px', height: '16px', backgroundColor: 'var(--border)' }} />

          {departmentGroups.size > 1 ? (
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
              {Array.from(departmentGroups.entries()).map(([dept, deptChildren]) => (
                <div key={dept} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {dept && (
                    <div style={{
                      fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: 'var(--text-muted)', padding: '2px 8px', marginBottom: '8px',
                      backgroundColor: 'var(--surface-elevated)', borderRadius: '4px',
                      border: '1px solid var(--border)',
                    }}>
                      {dept}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {deptChildren.map((child, idx) => (
                      <div key={child.agent.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                        <AgentNode
                          node={child}
                          expanded={expanded}
                          onToggle={onToggle}
                          onNavigate={onNavigate}
                          depth={depth + 1}
                        />
                        {idx < deptChildren.length - 1 && (
                          <div style={{ width: '16px', height: '2px', backgroundColor: 'var(--border)', marginTop: '24px', flexShrink: 0 }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
              {children.map((child, idx) => (
                <div key={child.agent.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '2px', height: '16px', backgroundColor: 'var(--border)' }} />
                  <AgentNode
                    node={child}
                    expanded={expanded}
                    onToggle={onToggle}
                    onNavigate={onNavigate}
                    depth={depth + 1}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function collectIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  for (const n of nodes) {
    ids.push(n.agent.id);
    ids.push(...collectIds(n.children));
  }
  return ids;
}

export function OrgChartPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['org-chart'],
    queryFn: () => apiGet<{ agents: OrgAgent[]; stats: OrgStats }>('/v1/agents/org-chart'),
  });

  const agents = data?.agents || [];
  const stats = data?.stats;
  const tree = buildTree(agents);

  const handleExpandAll = () => {
    const all = new Set(collectIds(tree));
    setExpanded(all);
    setAllExpanded(true);
  };

  const handleCollapseAll = () => {
    setExpanded(new Set());
    setAllExpanded(false);
  };

  const handleToggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNavigate = (id: string) => {
    navigate(`/agents/${id}`);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Organisation Chart
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Hierarchical view of your agent team structure
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleExpandAll}
            style={{
              padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
              backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            style={{
              padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
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
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '12px', marginBottom: '24px',
        }}>
          {[
            { label: 'Total Agents', value: stats.total, icon: Users, color: 'var(--text-secondary)' },
            { label: 'Active', value: stats.active, icon: Zap, color: '#32D74B' },
            { label: 'Lead Agents', value: stats.leads, icon: Award, color: '#FF3B30' },
            { label: 'Specialists', value: stats.specialists, icon: GitBranch, color: '#0A84FF' },
            { label: 'Interns', value: stats.interns, icon: Users, color: '#32D74B' },
            { label: 'Disabled', value: stats.disabled, icon: Users, color: '#636366' },
          ].map(stat => (
            <div key={stat.label} style={{
              backgroundColor: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <stat.icon size={16} color={stat.color} />
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        backgroundColor: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '32px 24px',
        overflowX: 'auto',
      }}>
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Loading org chart…
          </div>
        )}

        {isError && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            Failed to load org chart
          </div>
        )}

        {!isLoading && !isError && agents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <GitBranch size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No agents yet</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Create agents to see them here</div>
          </div>
        )}

        {!isLoading && !isError && tree.length > 0 && (
          <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center', minWidth: 'max-content' }}>
            {tree.map(rootNode => (
              <AgentNode
                key={rootNode.agent.id}
                node={rootNode}
                expanded={expanded}
                onToggle={handleToggle}
                onNavigate={handleNavigate}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {[
          { color: '#FF3B30', label: 'Lead' },
          { color: '#0A84FF', label: 'Specialist' },
          { color: '#32D74B', label: 'Intern' },
          { color: '#32D74B', dot: true, label: 'Active' },
          { color: '#FFD60A', dot: true, label: 'Idle' },
          { color: '#636366', dot: true, label: 'Disabled' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: item.dot ? '8px' : '10px',
              height: item.dot ? '8px' : '10px',
              borderRadius: item.dot ? '50%' : '3px',
              backgroundColor: item.color,
            }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
