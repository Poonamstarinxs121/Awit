import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { AgentDesk } from './AgentDesk';
import type { Agent } from '../../types';

const ACCENT_COLORS = ['#FF3B30', '#0A84FF', '#32D74B', '#FF9500', '#BF5AF2', '#FF375F', '#64D2FF', '#FFD60A'];

interface OfficeSceneProps {
  agents: Agent[];
}

function Floor({ size }: { size: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#1A1A1A" />
    </mesh>
  );
}

function GridLines({ size }: { size: number }) {
  return (
    <gridHelper
      args={[size, size * 2, '#2A2A2A', '#222222']}
      position={[0, 0.01, 0]}
    />
  );
}

export function OfficeScene({ agents }: OfficeSceneProps) {
  const cols = Math.max(3, Math.ceil(Math.sqrt(agents.length)));
  const spacing = 3;

  const positions: [number, number, number][] = agents.map((_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const offsetX = ((cols - 1) * spacing) / 2;
    const offsetZ = ((Math.ceil(agents.length / cols) - 1) * spacing) / 2;
    return [col * spacing - offsetX, 0, row * spacing - offsetZ];
  });

  const floorSize = Math.max(cols * spacing + 4, 20);

  return (
    <Canvas
      camera={{
        position: [floorSize * 0.4, floorSize * 0.5, floorSize * 0.4],
        fov: 45,
        near: 0.1,
        far: 200,
      }}
      style={{ background: '#0C0C0C' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} color="#4488ff" />

      <Floor size={floorSize} />
      <GridLines size={floorSize} />

      {agents.map((agent, i) => (
        <AgentDesk
          key={agent.id}
          agent={agent}
          position={positions[i]}
          color={ACCENT_COLORS[i % ACCENT_COLORS.length]}
        />
      ))}

      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={5}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2.2}
      />
    </Canvas>
  );
}
