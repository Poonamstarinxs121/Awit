import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Cpu, MemoryStick, HardDrive, Wifi, WifiOff } from 'lucide-react';
import { Suspense, useState, useCallback } from 'react';
import { apiGet } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import Office3D from '../components/Office3D/Office3D';
import type { OfficeAgent } from '../components/Office3D/types';
import { mapStatusForOffice, assignAgentColor } from '../components/Office3D/types';

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
    agent_statuses: { name?: string; status?: string; role?: string; current_task?: string; model?: string }[];
    created_at: string;
  }[];
  telemetry: {
    telemetry_type: string;
    payload: Record<string, unknown>;
    recorded_at: string;
    created_at: string;
  }[];
}

const STATUS_CONFIG: Record<string, { color: string; glow: string; label: string }> = {
  online:   { color: '#30D158', glow: 'rgba(48,209,88,0.4)', label: 'Online' },
  degraded: { color: '#FF9F0A', glow: 'rgba(255,159,10,0.4)', label: 'Degraded' },
  offline:  { color: '#FF453A', glow: 'rgba(255,69,58,0.4)', label: 'Offline' },
};

function getBarColor(value: number): string {
  if (value >= 90) return '#FF453A';
  if (value >= 70) return '#FF9F0A';
  return '#30D158';
}

export function NodeOfficePage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['node-office', nodeId],
    queryFn: () => apiGet<NodeDetail>(`/v1/nodes/${nodeId}`),
    enabled: !!nodeId,
    refetchInterval: 15000,
  });

  const mapAgentsFromHeartbeat = useCallback((detail: NodeDetail): OfficeAgent[] => {
    const latestHeartbeat = detail.heartbeats.length > 0 ? detail.heartbeats[0] : null;
    const agentStatuses = latestHeartbeat?.agent_statuses || [];

    return agentStatuses.map((agent, index) => ({
      id: `node-agent-${index}`,
      name: agent.name || `Agent ${index + 1}`,
      color: assignAgentColor(index),
      role: agent.role,
      status: mapStatusForOffice(agent.status || 'idle'),
      currentTask: agent.current_task,
      model: agent.model,
    }));
  }, []);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', backgroundColor: '#0C0C0C',
      }}>
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', backgroundColor: '#0C0C0C', color: '#F5F5F5', gap: '16px',
      }}>
        <p style={{ fontSize: '16px', color: '#FF453A' }}>
          {error ? (error as Error).message : 'Node not found'}
        </p>
        <button
          onClick={() => navigate('/fleet')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px',
            backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A',
            color: '#F5F5F5', fontSize: '13px', cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} /> Back to Fleet
        </button>
      </div>
    );
  }

  const { node } = data;
  const agents = mapAgentsFromHeartbeat(data);
  const statusCfg = STATUS_CONFIG[node.status] || STATUS_CONFIG.offline;
  const cpu = node.system_info?.cpu_percent ?? 0;
  const ram = node.system_info?.memory_percent ?? 0;
  const disk = node.system_info?.disk_percent ?? 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <Office3D
        agents={agents}
        officeName={node.name}
        nodeId={node.id}
        showFurniture={true}
        onAgentClick={(agentId) => setSelectedAgentId(agentId === selectedAgentId ? null : agentId)}
      />

      <div style={{
        position: 'absolute', top: '16px', left: '16px',
        display: 'flex', flexDirection: 'column', gap: '8px',
        zIndex: 20, pointerEvents: 'auto',
      }}>
        <button
          onClick={() => navigate('/fleet')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px',
            backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            border: '1px solid #2A2A2A', color: '#F5F5F5',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} /> Back to Fleet
        </button>
      </div>

      <div style={{
        position: 'absolute', top: '16px', right: '16px',
        display: 'flex', flexDirection: 'column', gap: '8px',
        zIndex: 20,
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          border: '1px solid #2A2A2A', borderRadius: '10px',
          padding: '14px 16px', minWidth: '200px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              backgroundColor: statusCfg.color, boxShadow: `0 0 8px ${statusCfg.glow}`,
            }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5' }}>
              {node.name}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            {node.status === 'online' ? (
              <Wifi size={12} style={{ color: statusCfg.color }} />
            ) : (
              <WifiOff size={12} style={{ color: statusCfg.color }} />
            )}
            <span style={{ fontSize: '11px', fontWeight: 600, color: statusCfg.color }}>
              {statusCfg.label}
            </span>
            <span style={{ fontSize: '10px', color: '#888', marginLeft: 'auto' }}>
              {agents.length} agent{agents.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <MetricRow icon={Cpu} label="CPU" value={cpu} color={getBarColor(cpu)} />
            <MetricRow icon={MemoryStick} label="RAM" value={ram} color={getBarColor(ram)} />
            <MetricRow icon={HardDrive} label="Disk" value={disk} color={getBarColor(disk)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Icon size={11} style={{ color: '#888', flexShrink: 0 }} />
      <span style={{ fontSize: '10px', color: '#888', width: '28px', flexShrink: 0 }}>{label}</span>
      <div style={{
        flex: 1, height: '4px', borderRadius: '2px',
        backgroundColor: '#1A1A1A', overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          height: '100%', borderRadius: '2px',
          backgroundColor: color, transition: 'width 300ms ease',
        }} />
      </div>
      <span style={{ fontSize: '10px', color: '#ccc', width: '28px', textAlign: 'right', flexShrink: 0 }}>
        {value.toFixed(0)}%
      </span>
    </div>
  );
}
