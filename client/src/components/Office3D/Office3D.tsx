import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment } from '@react-three/drei';
import { Suspense, useState, useMemo } from 'react';
import { Vector3 } from 'three';
import type { OfficeAgent, OfficeAgentWithPosition } from './types';
import { calculateDeskPositions } from './types';
import AgentDesk from './AgentDesk';
import Floor from './Floor';
import Lights from './Lights';
import AgentPanel from './AgentPanel';
import FileCabinet from './FileCabinet';
import Whiteboard from './Whiteboard';
import CoffeeMachine from './CoffeeMachine';
import PlantPot from './PlantPot';
import WallClock from './WallClock';
import FirstPersonControls from './FirstPersonControls';
import MovingAvatar from './MovingAvatar';

interface Office3DProps {
  agents: OfficeAgent[];
  officeName?: string;
  nodeId?: string;
  compact?: boolean;
  showFurniture?: boolean;
  onAgentClick?: (agentId: string) => void;
}

export default function Office3D({
  agents,
  officeName = 'The Office',
  compact = false,
  showFurniture = true,
  onAgentClick,
}: Office3DProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [interactionModal, setInteractionModal] = useState<string | null>(null);
  const [controlMode, setControlMode] = useState<'orbit' | 'fps'>('orbit');
  const [avatarPositions, setAvatarPositions] = useState<Map<string, any>>(new Map());

  const agentsWithPositions: OfficeAgentWithPosition[] = useMemo(() => {
    const positions = calculateDeskPositions(agents.length);
    return agents.map((agent, i) => ({
      ...agent,
      position: positions[i] || [0, 0, 0],
    }));
  }, [agents]);

  const officeBounds = useMemo(() => {
    if (agentsWithPositions.length === 0) return { minX: -8, maxX: 8, minZ: -7, maxZ: 7 };
    const xs = agentsWithPositions.map(a => a.position[0]);
    const zs = agentsWithPositions.map(a => a.position[2]);
    const pad = 4;
    return {
      minX: Math.min(...xs) - pad,
      maxX: Math.max(...xs) + pad,
      minZ: Math.min(...zs) - pad,
      maxZ: Math.max(...zs) + pad,
    };
  }, [agentsWithPositions]);

  const obstacles = useMemo(() => {
    const obs = agentsWithPositions.map(agent => ({
      position: new Vector3(agent.position[0], 0, agent.position[2]),
      radius: 1.5,
    }));
    if (showFurniture) {
      obs.push(
        { position: new Vector3(officeBounds.minX + 1, 0, officeBounds.minZ + 2), radius: 0.8 },
        { position: new Vector3(0, 0, officeBounds.minZ), radius: 1.5 },
        { position: new Vector3(officeBounds.maxX - 1, 0, officeBounds.minZ + 2), radius: 0.6 },
      );
    }
    return obs;
  }, [agentsWithPositions, showFurniture, officeBounds]);

  const handleDeskClick = (agentId: string) => {
    if (onAgentClick) {
      onAgentClick(agentId);
    } else {
      setSelectedAgent(agentId);
    }
  };

  const handleClosePanel = () => setSelectedAgent(null);
  const handleCloseModal = () => setInteractionModal(null);

  const handleAvatarPositionUpdate = (id: string, position: any) => {
    setAvatarPositions(prev => new Map(prev).set(id, position));
  };

  const wallSize = Math.max(
    officeBounds.maxX - officeBounds.minX + 8,
    officeBounds.maxZ - officeBounds.minZ + 8,
    20
  );

  const cameraDistance = compact ? 10 : Math.max(12, agents.length * 1.5);

  return (
    <div style={{
      position: compact ? 'relative' : 'absolute',
      inset: compact ? undefined : 0,
      height: compact ? '100%' : '100vh',
      width: compact ? '100%' : '100vw',
      background: '#0C0C0C',
    }}>
      <Canvas
        camera={{ position: [0, cameraDistance * 0.7, cameraDistance], fov: 60 }}
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
          <Lights />
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="sunset" />
          <Floor />

          <group>
            <mesh position={[0, 3, -(wallSize / 2)]} receiveShadow>
              <boxGeometry args={[wallSize, 6, 0.2]} />
              <meshStandardMaterial color="#1a202c" roughness={0.9} />
            </mesh>
            <mesh position={[-(wallSize / 2), 3, 0]} receiveShadow>
              <boxGeometry args={[0.2, 6, wallSize]} />
              <meshStandardMaterial color="#1a202c" roughness={0.9} />
            </mesh>
            <mesh position={[wallSize / 2, 3, 0]} receiveShadow>
              <boxGeometry args={[0.2, 6, wallSize]} />
              <meshStandardMaterial color="#1a202c" roughness={0.9} />
            </mesh>
          </group>

          {agentsWithPositions.map((agent) => (
            <AgentDesk
              key={agent.id}
              agent={agent}
              onClick={() => handleDeskClick(agent.id)}
              isSelected={selectedAgent === agent.id}
            />
          ))}

          {!compact && agentsWithPositions.map((agent) => (
            <MovingAvatar
              key={`avatar-${agent.id}`}
              agent={agent}
              officeBounds={officeBounds}
              obstacles={obstacles}
              otherAvatarPositions={avatarPositions}
              onPositionUpdate={handleAvatarPositionUpdate}
            />
          ))}

          {showFurniture && (
            <>
              <FileCabinet
                position={[officeBounds.minX + 1, 0, officeBounds.minZ + 2]}
                onClick={() => setInteractionModal('memory')}
              />
              <Whiteboard
                position={[0, 0, officeBounds.minZ]}
                rotation={[0, 0, 0]}
                onClick={() => setInteractionModal('roadmap')}
              />
              <CoffeeMachine
                position={[officeBounds.maxX - 1, 0.8, officeBounds.minZ + 2]}
                onClick={() => setInteractionModal('energy')}
              />
              <PlantPot position={[officeBounds.minX + 2, 0, officeBounds.maxZ - 1]} size="large" />
              <PlantPot position={[officeBounds.maxX - 2, 0, officeBounds.maxZ - 1]} size="medium" />
              <PlantPot position={[officeBounds.minX + 1, 0, 0]} size="small" />
              <PlantPot position={[officeBounds.maxX - 1, 0, 0]} size="small" />
              <WallClock
                position={[0, 2.5, officeBounds.minZ + 0.2]}
                rotation={[0, 0, 0]}
              />
            </>
          )}

          {controlMode === 'orbit' ? (
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              minDistance={5}
              maxDistance={50}
              maxPolarAngle={Math.PI / 2.2}
            />
          ) : (
            <FirstPersonControls moveSpeed={5} />
          )}
        </Suspense>
      </Canvas>

      {selectedAgent && !onAgentClick && agentsWithPositions.find(a => a.id === selectedAgent) && (
        <AgentPanel
          agent={agentsWithPositions.find(a => a.id === selectedAgent)!}
          onClose={handleClosePanel}
        />
      )}

      {interactionModal && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            background: '#1A1A1A', border: '1px solid #FF3B30',
            borderRadius: '12px', padding: '32px', maxWidth: '600px', width: '100%', margin: '0 16px',
            color: '#F5F5F5',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#FF3B30' }}>
                {interactionModal === 'memory' && 'Memory Browser'}
                {interactionModal === 'roadmap' && 'Roadmap & Planning'}
                {interactionModal === 'energy' && 'Agent Energy Dashboard'}
              </h2>
              <button onClick={handleCloseModal} style={{
                background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer',
              }}>x</button>
            </div>
            <div style={{ color: '#ccc', fontSize: '14px', lineHeight: 1.6 }}>
              {interactionModal === 'memory' && (
                <div>
                  <p style={{ marginBottom: '12px' }}>Access to workspace memories and files</p>
                  <div style={{ background: '#0C0C0C', padding: '16px', borderRadius: '8px', border: '1px solid #2A2A2A' }}>
                    <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Quick links:</p>
                    <p>File Explorer | Memory Browser</p>
                  </div>
                </div>
              )}
              {interactionModal === 'roadmap' && (
                <div>
                  <p style={{ marginBottom: '12px' }}>Project roadmap and planning board</p>
                  <div style={{ background: '#0C0C0C', padding: '16px', borderRadius: '8px', border: '1px solid #2A2A2A' }}>
                    <p>Active agents: {agents.filter(a => a.status === 'working').length}</p>
                    <p>Idle agents: {agents.filter(a => a.status === 'idle').length}</p>
                    <p>Total: {agents.length}</p>
                  </div>
                </div>
              )}
              {interactionModal === 'energy' && (
                <div>
                  <p style={{ marginBottom: '12px' }}>Agent activity and energy levels</p>
                  <div style={{ background: '#0C0C0C', padding: '16px', borderRadius: '8px', border: '1px solid #2A2A2A' }}>
                    <p>Active: {agents.filter(a => a.status === 'working' || a.status === 'active').length} / {agents.length}</p>
                    <p>Errors: {agents.filter(a => a.status === 'error').length}</p>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleCloseModal} style={{
              marginTop: '20px', width: '100%', background: '#FF3B30', color: '#fff',
              border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
            }}>Close</button>
          </div>
        </div>
      )}

      {!compact && (
        <>
          <div style={{
            position: 'absolute', top: '16px', left: '16px',
            background: 'rgba(0,0,0,0.7)', color: '#F5F5F5',
            padding: '16px', borderRadius: '10px', backdropFilter: 'blur(8px)',
            border: '1px solid #2A2A2A',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--font-heading, Sora, sans-serif)' }}>
              {officeName}
            </h2>
            <div style={{ fontSize: '12px', marginBottom: '12px', color: '#888' }}>
              <p>Mode: {controlMode === 'orbit' ? 'Orbit' : 'FPS'}</p>
              {controlMode === 'orbit' ? (
                <p>Mouse: Rotate | Scroll: Zoom | Click: Select</p>
              ) : (
                <p>WASD: Move | Space/Shift: Up/Down | ESC: Unlock</p>
              )}
            </div>
            <button
              onClick={() => setControlMode(controlMode === 'orbit' ? 'fps' : 'orbit')}
              style={{
                width: '100%', background: '#FF3B30', color: '#fff',
                border: 'none', padding: '8px', borderRadius: '6px',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Switch to {controlMode === 'orbit' ? 'FPS' : 'Orbit'} Mode
            </button>
          </div>

          <div style={{
            position: 'absolute', bottom: '16px', right: '16px',
            background: 'rgba(0,0,0,0.7)', color: '#F5F5F5',
            padding: '12px', borderRadius: '10px', backdropFilter: 'blur(8px)',
            border: '1px solid #2A2A2A',
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Status</h3>
            <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { label: 'Working', color: '#22c55e' },
                { label: 'Thinking', color: '#3b82f6' },
                { label: 'Idle', color: '#6b7280' },
                { label: 'Error', color: '#ef4444' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
