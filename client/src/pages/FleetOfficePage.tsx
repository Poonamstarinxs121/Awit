import { useState, useMemo, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment, Text, Html } from '@react-three/drei';
import {
  Server, Bot, Wifi, WifiOff, List, Box,
  ArrowLeft,
} from 'lucide-react';
import { apiGet } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import type { OfficeAgent } from '../components/Office3D/types';
import { mapStatusForOffice, assignAgentColor, calculateDeskPositions } from '../components/Office3D/types';
import Floor from '../components/Office3D/Floor';
import Lights from '../components/Office3D/Lights';

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
  agent_statuses?: { name?: string; status?: string; id?: string }[];
  created_at: string;
  updated_at: string;
}

interface NodesResponse {
  nodes: NodeItem[];
}

const STATUS_WALL_COLORS: Record<string, string> = {
  online: '#1a3a2c',
  degraded: '#3a3020',
  offline: '#3a1a1a',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  online: '#30D158',
  degraded: '#FF9F0A',
  offline: '#FF453A',
};

function NodeRoom({
  node,
  position,
  onClick,
  onHover,
  onUnhover,
  agents,
}: {
  node: NodeItem;
  position: [number, number, number];
  onClick: () => void;
  onHover: () => void;
  onUnhover: () => void;
  agents: OfficeAgent[];
}) {
  const wallColor = STATUS_WALL_COLORS[node.status] || STATUS_WALL_COLORS.offline;
  const dotColor = STATUS_DOT_COLORS[node.status] || STATUS_DOT_COLORS.offline;
  const roomW = 10;
  const roomD = 8;
  const wallH = 4;

  const deskPositions = useMemo(() => {
    const positions = calculateDeskPositions(agents.length);
    return positions.map(p => [
      p[0] * 0.6,
      p[1],
      p[2] * 0.6,
    ] as [number, number, number]);
  }, [agents.length]);

  return (
    <group position={position}>
      <mesh
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); onUnhover(); document.body.style.cursor = 'default'; }}
      >
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
      </mesh>

      <mesh position={[0, wallH / 2, -roomD / 2]} receiveShadow>
        <boxGeometry args={[roomW, wallH, 0.15]} />
        <meshStandardMaterial color={wallColor} roughness={0.85} />
      </mesh>
      <mesh position={[-roomW / 2, wallH / 2, 0]} receiveShadow>
        <boxGeometry args={[0.15, wallH, roomD]} />
        <meshStandardMaterial color={wallColor} roughness={0.85} />
      </mesh>
      <mesh position={[roomW / 2, wallH / 2, 0]} receiveShadow>
        <boxGeometry args={[0.15, wallH, roomD]} />
        <meshStandardMaterial color={wallColor} roughness={0.85} />
      </mesh>

      {agents.map((agent, i) => {
        const dp = deskPositions[i];
        if (!dp) return null;
        const statusColor =
          agent.status === 'working' || agent.status === 'active' ? '#22c55e' :
          agent.status === 'thinking' ? '#3b82f6' :
          agent.status === 'error' ? '#ef4444' : '#6b7280';
        return (
          <group key={agent.id} position={dp}>
            <mesh position={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[1.2, 0.08, 0.7]} />
              <meshStandardMaterial color="#3a3a3a" />
            </mesh>
            <group position={[0, 0.6, 0]} scale={0.5}>
              <mesh position={[0, 0.4, 0]} castShadow>
                <boxGeometry args={[0.6, 0.8, 0.4]} />
                <meshStandardMaterial color={agent.color} />
              </mesh>
              <mesh position={[0, 1.0, 0]} castShadow>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                <meshStandardMaterial color={agent.color} />
              </mesh>
              <mesh position={[0, 1.35, 0]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.6} />
              </mesh>
            </group>
          </group>
        );
      })}

      <Text
        position={[0, wallH + 0.8, 0]}
        fontSize={0.6}
        color="#F5F5F5"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {node.name}
      </Text>

      <mesh position={[-1.5, wallH + 0.8, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={dotColor} emissive={dotColor} emissiveIntensity={0.8} />
      </mesh>

      <Text
        position={[0, wallH + 0.2, 0]}
        fontSize={0.3}
        color="#888888"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {`${agents.length} agent${agents.length !== 1 ? 's' : ''}`}
      </Text>
    </group>
  );
}

function HubRoom({
  position,
  agents,
}: {
  position: [number, number, number];
  agents: OfficeAgent[];
}) {
  const roomW = 14;
  const roomD = 10;
  const wallH = 5;

  const deskPositions = useMemo(() => {
    const positions = calculateDeskPositions(agents.length);
    return positions.map(p => [
      p[0] * 0.6,
      p[1],
      p[2] * 0.6,
    ] as [number, number, number]);
  }, [agents.length]);

  return (
    <group position={position}>
      <mesh
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color="#1e2a1e" roughness={0.85} />
      </mesh>

      <mesh position={[0, wallH / 2, -roomD / 2]} receiveShadow>
        <boxGeometry args={[roomW, wallH, 0.15]} />
        <meshStandardMaterial color="#1a2a3c" roughness={0.85} />
      </mesh>
      <mesh position={[-roomW / 2, wallH / 2, 0]} receiveShadow>
        <boxGeometry args={[0.15, wallH, roomD]} />
        <meshStandardMaterial color="#1a2a3c" roughness={0.85} />
      </mesh>
      <mesh position={[roomW / 2, wallH / 2, 0]} receiveShadow>
        <boxGeometry args={[0.15, wallH, roomD]} />
        <meshStandardMaterial color="#1a2a3c" roughness={0.85} />
      </mesh>

      {agents.map((agent, i) => {
        const dp = deskPositions[i];
        if (!dp) return null;
        const statusColor =
          agent.status === 'working' || agent.status === 'active' ? '#22c55e' :
          agent.status === 'thinking' ? '#3b82f6' :
          agent.status === 'error' ? '#ef4444' : '#6b7280';
        return (
          <group key={agent.id} position={dp}>
            <mesh position={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[1.2, 0.08, 0.7]} />
              <meshStandardMaterial color="#3a3a3a" />
            </mesh>
            <group position={[0, 0.6, 0]} scale={0.5}>
              <mesh position={[0, 0.4, 0]} castShadow>
                <boxGeometry args={[0.6, 0.8, 0.4]} />
                <meshStandardMaterial color={agent.color} />
              </mesh>
              <mesh position={[0, 1.0, 0]} castShadow>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                <meshStandardMaterial color={agent.color} />
              </mesh>
              <mesh position={[0, 1.35, 0]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.6} />
              </mesh>
            </group>
          </group>
        );
      })}

      <Text
        position={[0, wallH + 1, 0]}
        fontSize={0.8}
        color="#FF3B30"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        HUB
      </Text>

      <mesh position={[-1.8, wallH + 1, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#30D158" emissive="#30D158" emissiveIntensity={0.8} />
      </mesh>

      <Text
        position={[0, wallH + 0.3, 0]}
        fontSize={0.35}
        color="#888888"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {`${agents.length} agent${agents.length !== 1 ? 's' : ''}`}
      </Text>
    </group>
  );
}

function FleetScene({
  nodes,
  hubAgents,
  onNodeClick,
}: {
  nodes: NodeItem[];
  hubAgents: OfficeAgent[];
  onNodeClick: (nodeId: string) => void;
}) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const nodePositions = useMemo(() => {
    const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length)));
    const spacing = 16;
    return nodes.map((_, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = (col - (cols - 1) / 2) * spacing + 20;
      const z = (row - Math.floor(nodes.length / cols) / 2) * (spacing - 2);
      return [x, 0, z] as [number, number, number];
    });
  }, [nodes.length]);

  const nodeAgentsMap = useMemo(() => {
    const map: Record<string, OfficeAgent[]> = {};
    nodes.forEach((node) => {
      const statuses = node.agent_statuses || [];
      map[node.id] = statuses.map((s, i) => ({
        id: s.id || `${node.id}-agent-${i}`,
        name: s.name || `Agent ${i + 1}`,
        color: assignAgentColor(i),
        status: mapStatusForOffice(s.status || 'idle'),
      }));
      if (map[node.id].length === 0 && node.agent_count > 0) {
        for (let j = 0; j < node.agent_count; j++) {
          map[node.id].push({
            id: `${node.id}-placeholder-${j}`,
            name: `Agent ${j + 1}`,
            color: assignAgentColor(j),
            status: 'idle',
          });
        }
      }
    });
    return map;
  }, [nodes]);

  const hoveredNodeData = hoveredNode ? nodes.find(n => n.id === hoveredNode) : null;

  return (
    <>
      <Lights />
      <Sky sunPosition={[100, 20, 100]} />
      <Environment preset="sunset" />
      <Floor />

      <HubRoom position={[-15, 0, 0]} agents={hubAgents} />

      {nodes.map((node, i) => (
        <NodeRoom
          key={node.id}
          node={node}
          position={nodePositions[i]}
          agents={nodeAgentsMap[node.id] || []}
          onClick={() => onNodeClick(node.id)}
          onHover={() => setHoveredNode(node.id)}
          onUnhover={() => setHoveredNode(null)}
        />
      ))}

      {hoveredNodeData && (
        <Html
          position={[
            nodePositions[nodes.indexOf(hoveredNodeData)]?.[0] || 0,
            7,
            nodePositions[nodes.indexOf(hoveredNodeData)]?.[2] || 0,
          ]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: 'rgba(12,12,12,0.95)',
            border: '1px solid #2A2A2A',
            borderRadius: '10px',
            padding: '12px 16px',
            color: '#F5F5F5',
            fontSize: '12px',
            minWidth: '180px',
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
          }}>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
              {hoveredNodeData.name}
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '4px' }}>
              <span>CPU: {(hoveredNodeData.system_info?.cpu_percent ?? 0).toFixed(0)}%</span>
              <span>RAM: {(hoveredNodeData.system_info?.memory_percent ?? 0).toFixed(0)}%</span>
            </div>
            <div style={{ color: '#888' }}>
              {hoveredNodeData.agent_count} agent{hoveredNodeData.agent_count !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
              Click to enter office
            </div>
          </div>
        </Html>
      )}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={10}
        maxDistance={100}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  );
}

export function FleetOfficePage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'3d' | 'list'>('3d');

  const { data: nodesData, isLoading } = useQuery({
    queryKey: ['fleet-nodes-office'],
    queryFn: () => apiGet<NodesResponse>('/v1/nodes'),
    refetchInterval: 15000,
  });

  const { data: hubAgentsData } = useQuery({
    queryKey: ['hub-agents-office'],
    queryFn: () => apiGet<{ agents: any[] }>('/v1/agents'),
    refetchInterval: 15000,
  });

  const nodes = nodesData?.nodes ?? [];
  const onlineCount = nodes.filter(n => n.status === 'online').length;
  const offlineCount = nodes.filter(n => n.status === 'offline').length;
  const totalAgents = nodes.reduce((sum, n) => sum + n.agent_count, 0);

  const hubAgents: OfficeAgent[] = useMemo(() => {
    if (!hubAgentsData?.agents) return [];
    return hubAgentsData.agents.map((a: any, i: number) => ({
      id: a.id || `hub-${i}`,
      name: a.name || `Agent ${i + 1}`,
      emoji: a.emoji,
      color: a.color || assignAgentColor(i),
      role: a.role,
      status: mapStatusForOffice(a.status || 'idle'),
      currentTask: a.current_task,
      model: a.model,
    }));
  }, [hubAgentsData]);

  const handleNodeClick = (nodeId: string) => {
    navigate(`/fleet/nodes/${nodeId}/office`);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 0 16px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/fleet')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '4px',
              display: 'flex', alignItems: 'center',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700,
              color: 'var(--text-primary)', letterSpacing: '-0.3px', margin: 0,
            }}>
              Fleet Office
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              3D overview of all nodes and their agents
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Server size={13} /> {nodes.length} nodes
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Bot size={13} /> {totalAgents + hubAgents.length} agents
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Wifi size={13} style={{ color: '#30D158' }} /> {onlineCount}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <WifiOff size={13} style={{ color: '#FF453A' }} /> {offlineCount}
            </span>
          </div>

          <div style={{
            display: 'flex', borderRadius: '8px', overflow: 'hidden',
            border: '1px solid var(--border)',
          }}>
            <button
              onClick={() => setViewMode('3d')}
              style={{
                padding: '6px 12px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '4px',
                backgroundColor: viewMode === '3d' ? 'var(--accent)' : 'var(--surface)',
                color: viewMode === '3d' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <Box size={13} /> 3D
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '4px',
                backgroundColor: viewMode === 'list' ? 'var(--accent)' : 'var(--surface)',
                color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <List size={13} /> List
            </button>
          </div>
        </div>
      </div>

      {viewMode === '3d' ? (
        <div style={{
          flex: 1, borderRadius: '14px', overflow: 'hidden',
          border: '1px solid var(--border)',
          backgroundColor: '#0C0C0C',
          minHeight: '500px',
          position: 'relative',
        }}>
          <Canvas
            camera={{ position: [0, 25, 40], fov: 60 }}
            shadows
            gl={{ antialias: true, alpha: false }}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={
              <mesh>
                <boxGeometry args={[2, 2, 2]} />
                <meshStandardMaterial color="#FF3B30" />
              </mesh>
            }>
              <FleetScene
                nodes={nodes}
                hubAgents={hubAgents}
                onNodeClick={handleNodeClick}
              />
            </Suspense>
          </Canvas>

          <div style={{
            position: 'absolute', bottom: '16px', left: '16px',
            background: 'rgba(0,0,0,0.7)', color: '#F5F5F5',
            padding: '12px 16px', borderRadius: '10px',
            backdropFilter: 'blur(8px)', border: '1px solid #2A2A2A',
            fontSize: '12px',
          }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Controls</p>
            <p style={{ margin: 0, color: '#888' }}>Mouse: Rotate | Scroll: Zoom | Click room: Enter office</p>
          </div>

          <div style={{
            position: 'absolute', bottom: '16px', right: '16px',
            background: 'rgba(0,0,0,0.7)', color: '#F5F5F5',
            padding: '12px', borderRadius: '10px',
            backdropFilter: 'blur(8px)', border: '1px solid #2A2A2A',
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', margin: '0 0 8px' }}>Legend</h3>
            <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { label: 'Online', color: '#30D158' },
                { label: 'Degraded', color: '#FF9F0A' },
                { label: 'Offline', color: '#FF453A' },
                { label: 'Hub', color: '#FF3B30' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            backgroundColor: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{
                width: '12px', height: '12px', borderRadius: '50%',
                backgroundColor: '#FF3B30',
              }} />
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Hub (Central)
              </span>
              <span style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: '5px',
                backgroundColor: 'rgba(100,210,255,0.1)', color: '#64D2FF',
              }}>
                {hubAgents.length} agents
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {hubAgents.map(a => (
                <span key={a.id} style={{
                  fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
                  backgroundColor: 'var(--surface-elevated)',
                  color: 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    backgroundColor: a.status === 'working' ? '#22c55e' : a.status === 'error' ? '#ef4444' : '#6b7280',
                  }} />
                  {a.name}
                </span>
              ))}
            </div>
          </div>

          {nodes.map(node => {
            const dotColor = STATUS_DOT_COLORS[node.status] || STATUS_DOT_COLORS.offline;
            return (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                style={{
                  backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: '14px', padding: '18px 20px',
                  cursor: 'pointer', transition: 'border-color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      backgroundColor: dotColor,
                    }} />
                    <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {node.name}
                    </span>
                    <span style={{
                      fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                      backgroundColor: `${dotColor}22`, color: dotColor, fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>
                      {node.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '5px',
                      backgroundColor: 'rgba(100,210,255,0.1)', color: '#64D2FF',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                      <Bot size={11} /> {node.agent_count}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      CPU {(node.system_info?.cpu_percent ?? 0).toFixed(0)}% | RAM {(node.system_info?.memory_percent ?? 0).toFixed(0)}%
                    </span>
                  </div>
                </div>
                {node.agent_statuses && node.agent_statuses.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {node.agent_statuses.map((a, i) => (
                      <span key={i} style={{
                        fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
                        backgroundColor: 'var(--surface-elevated)',
                        color: 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        <span style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          backgroundColor: a.status === 'active' || a.status === 'working' ? '#22c55e' : '#6b7280',
                        }} />
                        {a.name || `Agent ${i + 1}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
