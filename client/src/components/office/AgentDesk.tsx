import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface AgentDeskProps {
  agent: {
    id: string;
    name: string;
    status: string;
    model_config?: Record<string, unknown>;
  };
  position: [number, number, number];
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#32D74B',
  idle: '#888888',
  error: '#FF3B30',
  disabled: '#555555',
};

const STATUS_EMISSIVE: Record<string, string> = {
  active: '#32D74B',
  idle: '#333333',
  error: '#FF3B30',
  disabled: '#222222',
};

export function AgentDesk({ agent, position, color }: AgentDeskProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Group>(null);

  const statusColor = STATUS_COLORS[agent.status] || STATUS_COLORS.idle;
  const emissiveColor = STATUS_EMISSIVE[agent.status] || STATUS_EMISSIVE.idle;
  const model = (agent.model_config as any)?.model || '';

  return (
    <group
      ref={meshRef}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/agents/${agent.id}`);
      }}
    >
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.8, 0.1, 1.0]} />
        <meshStandardMaterial color="#3A3A3A" />
      </mesh>

      <mesh position={[-0.7, 0.175, -0.35]}>
        <boxGeometry args={[0.08, 0.35, 0.08]} />
        <meshStandardMaterial color="#2A2A2A" />
      </mesh>
      <mesh position={[0.7, 0.175, -0.35]}>
        <boxGeometry args={[0.08, 0.35, 0.08]} />
        <meshStandardMaterial color="#2A2A2A" />
      </mesh>
      <mesh position={[-0.7, 0.175, 0.35]}>
        <boxGeometry args={[0.08, 0.35, 0.08]} />
        <meshStandardMaterial color="#2A2A2A" />
      </mesh>
      <mesh position={[0.7, 0.175, 0.35]}>
        <boxGeometry args={[0.08, 0.35, 0.08]} />
        <meshStandardMaterial color="#2A2A2A" />
      </mesh>

      <mesh position={[0, 0.45, -0.2]}>
        <boxGeometry args={[0.6, 0.4, 0.04]} />
        <meshStandardMaterial color="#1A1A1A" emissive={statusColor} emissiveIntensity={0.15} />
      </mesh>

      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
        <meshStandardMaterial
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={hovered ? 0.6 : 0.2}
        />
      </mesh>

      <mesh position={[-0.12, 1.02, 0.24]}>
        <boxGeometry args={[0.08, 0.08, 0.04]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.12, 1.02, 0.24]}>
        <boxGeometry args={[0.08, 0.08, 0.04]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>

      <pointLight
        position={[0, 1.4, 0]}
        color={statusColor}
        intensity={hovered ? 2 : 0.5}
        distance={3}
      />

      <Html
        position={[0, 0.05, 0.7]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          backgroundColor: 'rgba(26,26,26,0.9)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '4px',
          padding: '2px 8px',
          whiteSpace: 'nowrap',
          fontSize: '10px',
          fontWeight: 600,
          color: '#F5F5F5',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center',
        }}>
          {agent.name}
        </div>
      </Html>

      {hovered && (
        <Html
          position={[0, 1.6, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            backgroundColor: 'rgba(12,12,12,0.95)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            padding: '10px 14px',
            whiteSpace: 'nowrap',
            fontSize: '12px',
            color: '#F5F5F5',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            minWidth: '140px',
          }}>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>{agent.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%',
                backgroundColor: statusColor,
                boxShadow: `0 0 6px ${statusColor}`,
              }} />
              <span style={{ fontSize: '11px', color: '#aaa', textTransform: 'capitalize' }}>{agent.status}</span>
            </div>
            {model && (
              <div style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>{model}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
