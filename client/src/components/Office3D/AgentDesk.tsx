import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Box } from '@react-three/drei';
import type { Mesh } from 'three';
import type { OfficeAgentWithPosition } from './types';
import VoxelChair from './VoxelChair';
import VoxelKeyboard from './VoxelKeyboard';
import VoxelMacMini from './VoxelMacMini';

interface AgentDeskProps {
  agent: OfficeAgentWithPosition;
  onClick: () => void;
  isSelected: boolean;
}

export default function AgentDesk({ agent, onClick, isSelected }: AgentDeskProps) {
  const monitorRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((frameState) => {
    if (monitorRef.current && (agent.status === 'thinking')) {
      monitorRef.current.scale.setScalar(1 + Math.sin(frameState.clock.elapsedTime * 2) * 0.05);
    }
  });

  const getStatusColor = () => {
    switch (agent.status) {
      case 'working':
      case 'active':
        return '#22c55e';
      case 'thinking':
        return '#3b82f6';
      case 'error':
        return '#ef4444';
      case 'idle':
      default:
        return '#6b7280';
    }
  };

  const getMonitorEmissive = () => {
    switch (agent.status) {
      case 'working':
      case 'active':
        return '#15803d';
      case 'thinking':
        return '#1e40af';
      case 'error':
        return '#991b1b';
      case 'idle':
      default:
        return '#374151';
    }
  };

  return (
    <group position={agent.position}>
      <Box
        args={[2, 0.1, 1.5]}
        position={[0, 0.75, 0]}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={hovered || isSelected ? agent.color : '#8B4513'}
          emissive={hovered || isSelected ? agent.color : '#000000'}
          emissiveIntensity={hovered || isSelected ? 0.2 : 0}
        />
      </Box>

      <Box
        ref={monitorRef}
        args={[1.2, 0.8, 0.05]}
        position={[0, 1.5, -0.5]}
        castShadow
        onClick={onClick}
      >
        <meshStandardMaterial
          color={getStatusColor()}
          emissive={getMonitorEmissive()}
          emissiveIntensity={agent.status === 'idle' ? 0.1 : 0.5}
        />
      </Box>

      <Box args={[0.1, 0.4, 0.1]} position={[0, 1, -0.5]} castShadow>
        <meshStandardMaterial color="#2d2d2d" />
      </Box>

      <VoxelKeyboard position={[0, 0.81, 0.2]} rotation={[0, 0, 0]} />
      <VoxelMacMini position={[0.5, 0.825, -0.5]} />

      <group scale={2}>
        <VoxelChair position={[0, 0, 0.9]} rotation={[0, Math.PI, 0]} color="#1f2937" />
      </group>

      <Text
        position={[0, 2.5, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#000000"
      >
        {agent.emoji || ''} {agent.name}
      </Text>

      <Text
        position={[0, 2.2, 0]}
        fontSize={0.1}
        color={getStatusColor()}
        anchorX="center"
        anchorY="middle"
      >
        {agent.status.toUpperCase()}
        {agent.model && ` \u2022 ${agent.model}`}
      </Text>

      {[-0.8, 0.8].map((x, i) =>
        [-0.6, 0.6].map((z, j) => (
          <Box key={`leg-${i}-${j}`} args={[0.05, 0.7, 0.05]} position={[x, 0.35, z]} castShadow>
            <meshStandardMaterial color="#5d4037" />
          </Box>
        ))
      )}

      {isSelected && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.5, 32]} />
          <meshBasicMaterial color={agent.color} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}
