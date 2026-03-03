import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server, CheckCircle, AlertTriangle, XCircle, Plus,
  X, Copy, ChevronRight, Trash2, Clock, Cpu, HardDrive,
  MemoryStick, Bot, Wifi, Send,
} from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { Spinner } from '../components/ui/Spinner';

interface NodeItem {
  id: string;
  name: string;
  url: string | null;
  status: 'online' | 'offline' | 'degraded';
  last_heartbeat: string | null;
  system_info: {
    cpu_percent?: number;
    memory_percent?: number;
    disk_percent?: number;
    uptime_seconds?: number;
  };
  openclaw_version: string | null;
  agent_count: number;
  created_at: string;
  updated_at: string;
}

interface NodeDetail {
  node: NodeItem;
  heartbeats: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
    uptime_seconds: number;
    agent_statuses: { name?: string; status?: string }[];
    created_at: string;
  }[];
  telemetry: {
    telemetry_type: string;
    payload: Record<string, unknown>;
    recorded_at: string;
    created_at: string;
  }[];
}

interface RegisterResult {
  node_id: string;
  api_key: string;
  registered_at: string;
  message: string;
}

const STATUS_DOT: Record<string, { color: string; glow: string }> = {
  online:   { color: '#30D158', glow: 'rgba(48,209,88,0.4)' },
  degraded: { color: '#FF9F0A', glow: 'rgba(255,159,10,0.4)' },
  offline:  { color: '#FF453A', glow: 'rgba(255,69,58,0.4)' },
};

function timeSince(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatUptime(seconds: number | undefined): string {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{
      flex: 1, height: '6px', borderRadius: '3px',
      backgroundColor: 'var(--surface-elevated)',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, value))}%`,
        height: '100%', borderRadius: '3px',
        backgroundColor: color,
        transition: 'width 300ms ease',
      }} />
    </div>
  );
}

function getBarColor(value: number): string {
  if (value >= 90) return '#FF453A';
  if (value >= 70) return '#FF9F0A';
  return '#30D158';
}

export function FleetPage() {
  const queryClient = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerResult, setRegisterResult] = useState<RegisterResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);

  const { data: nodesData, isLoading } = useQuery({
    queryKey: ['fleet-nodes'],
    queryFn: () => apiGet<{ nodes: NodeItem[] }>('/v1/nodes'),
    refetchInterval: 15000,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['fleet-node-detail', detailNodeId],
    queryFn: () => apiGet<NodeDetail>(`/v1/nodes/${detailNodeId}`),
    enabled: !!detailNodeId,
    refetchInterval: 10000,
  });

  const registerMutation = useMutation({
    mutationFn: (name: string) => apiPost<RegisterResult>('/v1/nodes/register', { name }),
    onSuccess: (data) => {
      setRegisterResult(data);
      queryClient.invalidateQueries({ queryKey: ['fleet-nodes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/nodes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-nodes'] });
      setDetailNodeId(null);
    },
  });

  const nodes = nodesData?.nodes ?? [];
  const onlineCount = nodes.filter(n => n.status === 'online').length;
  const degradedCount = nodes.filter(n => n.status === 'degraded').length;
  const offlineCount = nodes.filter(n => n.status === 'offline').length;

  function handleRegister() {
    if (!registerName.trim()) return;
    registerMutation.mutate(registerName.trim());
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function closeRegister() {
    setShowRegister(false);
    setRegisterName('');
    setRegisterResult(null);
    setCopied(false);
  }

  const statCards = [
    { label: 'Total Nodes', value: nodes.length, color: '#64D2FF', Icon: Server },
    { label: 'Online', value: onlineCount, color: '#30D158', Icon: CheckCircle },
    { label: 'Degraded', value: degradedCount, color: '#FF9F0A', Icon: AlertTriangle },
    { label: 'Offline', value: offlineCount, color: '#FF453A', Icon: XCircle },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px', margin: '0 0 4px' }}>
            Fleet
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Manage connected OpenClaw nodes across your infrastructure
          </p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px',
            backgroundColor: 'var(--accent)', border: 'none',
            color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Plus size={15} /> Register Node
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {statCards.map(stat => (
          <div key={stat.label} style={{
            backgroundColor: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '9px',
              backgroundColor: 'var(--surface-elevated)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <stat.Icon size={18} style={{ color: stat.color }} />
            </div>
            <div>
              <p style={{ fontSize: '22px', fontWeight: 700, color: stat.color, fontFamily: 'var(--font-heading)', margin: 0, lineHeight: 1 }}>
                {stat.value}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Spinner /></div>
      ) : nodes.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px',
          padding: '60px 24px', textAlign: 'center',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'var(--surface-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Server size={28} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>No nodes registered</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px' }}>Register your first OpenClaw node to start building your fleet</p>
          <button
            onClick={() => setShowRegister(true)}
            style={{ padding: '9px 20px', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> Register First Node
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {nodes.map(node => {
            const dot = STATUS_DOT[node.status] || STATUS_DOT.offline;
            const cpu = node.system_info?.cpu_percent ?? 0;
            const ram = node.system_info?.memory_percent ?? 0;
            const disk = node.system_info?.disk_percent ?? 0;
            return (
              <div
                key={node.id}
                style={{
                  backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: '14px', padding: '18px 20px',
                  cursor: 'pointer', transition: 'border-color 150ms, background-color 150ms',
                }}
                onClick={() => setDetailNodeId(node.id)}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.backgroundColor = 'var(--card)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      backgroundColor: dot.color, boxShadow: `0 0 8px ${dot.glow}`,
                    }} />
                    <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {node.name}
                    </span>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>

                {node.url && (
                  <p style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', margin: '0 0 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.url}
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '30px', flexShrink: 0 }}>{cpu.toFixed(0)}%</span>
                    <ProgressBar value={cpu} color={getBarColor(cpu)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MemoryStick size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '30px', flexShrink: 0 }}>{ram.toFixed(0)}%</span>
                    <ProgressBar value={ram} color={getBarColor(ram)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HardDrive size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '30px', flexShrink: 0 }}>{disk.toFixed(0)}%</span>
                    <ProgressBar value={disk} color={getBarColor(disk)} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', fontWeight: 600,
                    padding: '2px 8px', borderRadius: '5px',
                    backgroundColor: 'rgba(100,210,255,0.1)', color: '#64D2FF',
                  }}>
                    <Bot size={11} /> {node.agent_count} agent{node.agent_count !== 1 ? 's' : ''}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <Clock size={11} /> {timeSince(node.last_heartbeat)}
                  </span>
                  {node.openclaw_version && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      v{node.openclaw_version}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detailNodeId && (
        <>
          <div
            onClick={() => setDetailNodeId(null)}
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 100,
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px',
            backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)',
            zIndex: 101, overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>
            {detailLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <Spinner />
              </div>
            ) : detailData ? (
              <DetailPanel
                data={detailData}
                onClose={() => setDetailNodeId(null)}
                onDelete={() => deleteMutation.mutate(detailNodeId)}
                deleting={deleteMutation.isPending}
              />
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Node not found
              </div>
            )}
          </div>
        </>
      )}

      {showRegister && (
        <>
          <div
            onClick={closeRegister}
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '460px', backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: '16px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '18px 22px', borderBottom: '1px solid var(--border)',
              }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                  Register Node
                </h2>
                <button onClick={closeRegister} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '22px' }}>
                {!registerResult ? (
                  <>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
                      Node Name
                    </label>
                    <input
                      value={registerName}
                      onChange={e => setRegisterName(e.target.value)}
                      placeholder="e.g. mac-mini-01"
                      onKeyDown={e => e.key === 'Enter' && handleRegister()}
                      style={{
                        width: '100%', padding: '10px 14px',
                        backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    {registerMutation.isError && (
                      <p style={{ fontSize: '12px', color: '#FF453A', margin: '8px 0 0' }}>
                        {(registerMutation.error as Error).message}
                      </p>
                    )}
                    <button
                      onClick={handleRegister}
                      disabled={registerMutation.isPending || !registerName.trim()}
                      style={{
                        width: '100%', marginTop: '16px', padding: '10px',
                        backgroundColor: 'var(--accent)', border: 'none', borderRadius: '8px',
                        color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                        opacity: registerMutation.isPending || !registerName.trim() ? 0.5 : 1,
                      }}
                    >
                      {registerMutation.isPending ? 'Registering...' : 'Register'}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{
                      backgroundColor: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)',
                      borderRadius: '10px', padding: '14px 16px', marginBottom: '16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <CheckCircle size={16} style={{ color: '#30D158' }} />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#30D158' }}>Node Registered</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                        Node ID: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>{registerResult.node_id}</code>
                      </p>
                    </div>

                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#FF9F0A', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
                      ⚠ API Key (shown once — copy now)
                    </label>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
                      borderRadius: '8px', padding: '10px 12px',
                    }}>
                      <code style={{
                        flex: 1, fontSize: '11px', fontFamily: 'var(--font-mono)',
                        color: 'var(--text-primary)', wordBreak: 'break-all',
                      }}>
                        {registerResult.api_key}
                      </code>
                      <button
                        onClick={() => copyKey(registerResult.api_key)}
                        style={{
                          flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                          color: copied ? '#30D158' : 'var(--text-muted)', padding: '4px',
                        }}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    {copied && <p style={{ fontSize: '11px', color: '#30D158', margin: '6px 0 0' }}>Copied to clipboard!</p>}

                    <div style={{
                      marginTop: '18px', padding: '14px 16px',
                      backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: '10px',
                    }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                        Setup Instructions
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>
                        Add these environment variables to your node's <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>.env</code> file:
                      </p>
                      <pre style={{
                        fontSize: '11px', fontFamily: 'var(--font-mono)',
                        color: 'var(--text-primary)', backgroundColor: 'var(--surface-elevated)',
                        padding: '10px 12px', borderRadius: '6px', overflow: 'auto',
                        border: '1px solid var(--border)', margin: 0, lineHeight: 1.6,
                      }}>
{`NODE_HUB_URL=${window.location.origin}
NODE_HUB_API_KEY=${registerResult.api_key}
NODE_ID=${registerResult.node_id}`}
                      </pre>
                    </div>

                    <button
                      onClick={closeRegister}
                      style={{
                        width: '100%', marginTop: '16px', padding: '10px',
                        backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
                        borderRadius: '8px', color: 'var(--text-primary)',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Done
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface NodeDispatch {
  id: string;
  task_id: string;
  node_id: string;
  node_name?: string;
  task_title?: string;
  task_description?: string;
  task_priority?: string;
  status: string;
  dispatched_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

const DISPATCH_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' },
  dispatched: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  accepted: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  running: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  completed: { color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  failed: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

function DetailPanel({ data, onClose, onDelete, deleting }: {
  data: NodeDetail;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { node, heartbeats, telemetry } = data;
  const dot = STATUS_DOT[node.status] || STATUS_DOT.offline;
  const cpu = node.system_info?.cpu_percent ?? 0;
  const ram = node.system_info?.memory_percent ?? 0;
  const disk = node.system_info?.disk_percent ?? 0;

  const latestAgents = heartbeats.length > 0 ? (heartbeats[0].agent_statuses || []) : [];

  const { data: dispatchesData } = useQuery({
    queryKey: ['node-dispatches', node.id],
    queryFn: () => apiGet<{ dispatches: NodeDispatch[] }>(`/v1/tasks/dispatch-by-node/${node.id}`),
    refetchInterval: 10000,
  });

  const nodeDispatches = dispatchesData?.dispatches ?? [];

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            backgroundColor: dot.color, boxShadow: `0 0 8px ${dot.glow}`,
          }} />
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-heading)' }}>
            {node.name}
          </h2>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{
          backgroundColor: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '16px', marginBottom: '16px',
        }}>
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
            Node Info
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <InfoRow label="Status" value={node.status.charAt(0).toUpperCase() + node.status.slice(1)} valueColor={dot.color} />
            {node.url && <InfoRow label="URL" value={node.url} mono />}
            <InfoRow label="Agents" value={String(node.agent_count)} />
            <InfoRow label="Last Heartbeat" value={timeSince(node.last_heartbeat)} />
            {node.openclaw_version && <InfoRow label="OpenClaw" value={`v${node.openclaw_version}`} />}
            <InfoRow label="Uptime" value={formatUptime(node.system_info?.uptime_seconds)} />
            <InfoRow label="Registered" value={new Date(node.created_at).toLocaleDateString()} />
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '16px', marginBottom: '16px',
        }}>
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
            System Stats
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <StatRow label="CPU" value={cpu} icon={Cpu} />
            <StatRow label="RAM" value={ram} icon={MemoryStick} />
            <StatRow label="Disk" value={disk} icon={HardDrive} />
          </div>

          {heartbeats.length > 1 && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                Last 24h CPU / RAM
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '40px' }}>
                {heartbeats.slice(0, 48).reverse().map((hb, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ height: `${Math.max(2, hb.cpu_percent * 0.4)}px`, backgroundColor: '#64D2FF', borderRadius: '1px', opacity: 0.7 }} />
                    <div style={{ height: `${Math.max(2, hb.memory_percent * 0.4)}px`, backgroundColor: '#30D158', borderRadius: '1px', opacity: 0.7 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '9px', color: '#64D2FF', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '1px', backgroundColor: '#64D2FF', display: 'inline-block' }} /> CPU
                </span>
                <span style={{ fontSize: '9px', color: '#30D158', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '1px', backgroundColor: '#30D158', display: 'inline-block' }} /> RAM
                </span>
              </div>
            </div>
          )}
        </div>

        {latestAgents.length > 0 && (
          <div style={{
            backgroundColor: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '16px', marginBottom: '16px',
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
              Agents ({latestAgents.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {latestAgents.map((agent, i) => {
                const agentDot = agent.status === 'active' ? STATUS_DOT.online : agent.status === 'error' ? STATUS_DOT.offline : STATUS_DOT.degraded;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '8px',
                    backgroundColor: 'var(--surface-elevated)',
                  }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: agentDot.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agent.name || `Agent ${i + 1}`}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {agent.status || 'unknown'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {nodeDispatches.length > 0 && (
          <div style={{
            backgroundColor: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '16px', marginBottom: '16px',
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
              Recent Dispatches ({nodeDispatches.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {nodeDispatches.slice(0, 15).map((d) => {
                const statusCfg = DISPATCH_STATUS_COLORS[d.status] || DISPATCH_STATUS_COLORS.pending;
                return (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '8px',
                    backgroundColor: 'var(--surface-elevated)',
                  }}>
                    <Send size={11} style={{ color: statusCfg.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0,
                      }}>
                        {d.task_title || `Task ${d.task_id.slice(0, 8)}...`}
                      </p>
                      {d.error && (
                        <p style={{ fontSize: '10px', color: '#EF4444', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.error}
                        </p>
                      )}
                    </div>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px',
                      padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                      backgroundColor: statusCfg.bg, color: statusCfg.color,
                    }}>
                      {d.status}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {timeSince(d.dispatched_at || d.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {telemetry.length > 0 && (
          <div style={{
            backgroundColor: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '16px', marginBottom: '16px',
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
              Recent Telemetry
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {telemetry.slice(0, 10).map((t, i) => {
                const typeColors: Record<string, string> = { session: '#64D2FF', cost: '#FF9F0A', activity: '#30D158' };
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '8px',
                    backgroundColor: 'var(--surface-elevated)',
                  }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px',
                      padding: '2px 6px', borderRadius: '4px',
                      backgroundColor: `${typeColors[t.telemetry_type] || 'var(--text-muted)'}20`,
                      color: typeColors[t.telemetry_type] || 'var(--text-muted)',
                    }}>
                      {t.telemetry_type}
                    </span>
                    <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {JSON.stringify(t.payload).substring(0, 60)}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {timeSince(t.recorded_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={onDelete}
          disabled={deleting}
          style={{
            width: '100%', padding: '10px',
            backgroundColor: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.25)',
            borderRadius: '8px', color: '#FF453A',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            opacity: deleting ? 0.5 : 1,
          }}
        >
          <Trash2 size={14} /> {deleting ? 'Removing...' : 'Remove Node'}
        </button>
      </div>
    </>
  );
}

function InfoRow({ label, value, valueColor, mono }: { label: string; value: string; valueColor?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontSize: '12px', fontWeight: 500,
        color: valueColor || 'var(--text-primary)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      }}>
        {value}
      </span>
    </div>
  );
}

function StatRow({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Cpu }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '32px', flexShrink: 0 }}>{label}</span>
      <ProgressBar value={value} color={getBarColor(value)} />
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', width: '36px', textAlign: 'right', flexShrink: 0 }}>
        {value.toFixed(0)}%
      </span>
    </div>
  );
}
