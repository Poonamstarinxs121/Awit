import { useGLTF } from '@react-three/drei';
import { Sphere } from '@react-three/drei';
import type { AgentConfig } from './agentsConfig';
import { useEffect, useState, Suspense } from 'react';

interface AvatarModelProps {
  agent: AgentConfig;
  position: [number, number, number];
}

function LoadedModel({ modelPath, position }: { modelPath: string; position: [number, number, number] }) {
  const { scene } = useGLTF(modelPath);

  return (
    <primitive
      object={scene.clone()}
      position={position}
      scale={0.8}
      rotation={[0, Math.PI, 0]}
      castShadow
      receiveShadow
    />
  );
}

export default function AvatarModel({ agent, position }: AvatarModelProps) {
  const modelPath = `/models/${agent.id}.glb`;
  const [exists, setExists] = useState<boolean>(false);

  useEffect(() => {
    fetch(modelPath, { method: 'HEAD' })
      .then(res => setExists(res.ok))
      .catch(() => setExists(false));
  }, [modelPath]);

  if (!exists) {
    return (
      <Sphere args={[0.3, 16, 16]} position={position} castShadow>
        <meshStandardMaterial color={agent.color} emissive={agent.color} emissiveIntensity={0.3} />
      </Sphere>
    );
  }

  return (
    <Suspense fallback={
      <Sphere args={[0.3, 16, 16]} position={position} castShadow>
        <meshStandardMaterial color={agent.color} emissive={agent.color} emissiveIntensity={0.3} />
      </Sphere>
    }>
      <LoadedModel modelPath={modelPath} position={position} />
    </Suspense>
  );
}
