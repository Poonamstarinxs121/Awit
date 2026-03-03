import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import VoxelAvatar from './VoxelAvatar';
import type { OfficeAgentWithPosition } from './types';

interface Obstacle {
  position: Vector3;
  radius: number;
}

interface MovingAvatarProps {
  agent: OfficeAgentWithPosition;
  officeBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  obstacles: Obstacle[];
  otherAvatarPositions: Map<string, Vector3>;
  onPositionUpdate: (id: string, pos: Vector3) => void;
}

export default function MovingAvatar({
  agent,
  officeBounds,
  obstacles,
  otherAvatarPositions,
  onPositionUpdate,
}: MovingAvatarProps) {
  const groupRef = useRef<Group>(null);

  const [initialPos] = useState(() => {
    let pos: Vector3;
    let attempts = 0;
    const minDistanceToObstacle = 1.5;

    do {
      const x = Math.random() * (officeBounds.maxX - officeBounds.minX - 2) + officeBounds.minX + 1;
      const z = Math.random() * (officeBounds.maxZ - officeBounds.minZ - 2) + officeBounds.minZ + 1;
      pos = new Vector3(x, 0.6, z);

      let isFree = true;
      for (const obstacle of obstacles) {
        const distance = pos.distanceTo(obstacle.position);
        if (distance < obstacle.radius + minDistanceToObstacle) {
          isFree = false;
          break;
        }
      }

      if (isFree) break;
      attempts++;
    } while (attempts < 50);

    return pos!;
  });

  const [targetPos, setTargetPos] = useState(initialPos);
  const currentPos = useRef(initialPos.clone());

  useEffect(() => {
    onPositionUpdate(agent.id, initialPos.clone());
  }, []);

  const isPositionFree = (pos: Vector3): boolean => {
    const minDistanceToObstacle = 1.5;
    const minDistanceToAvatar = 1.2;

    for (const obstacle of obstacles) {
      if (pos.distanceTo(obstacle.position) < obstacle.radius + minDistanceToObstacle) return false;
    }

    for (const [otherId, otherPos] of otherAvatarPositions.entries()) {
      if (otherId === agent.id) continue;
      if (pos.distanceTo(otherPos) < minDistanceToAvatar) return false;
    }

    return true;
  };

  useEffect(() => {
    const getNewTarget = () => {
      let attempts = 0;
      let newPos: Vector3;

      do {
        const x = Math.random() * (officeBounds.maxX - officeBounds.minX) + officeBounds.minX;
        const z = Math.random() * (officeBounds.maxZ - officeBounds.minZ) + officeBounds.minZ;
        newPos = new Vector3(x, 0.6, z);
        attempts++;
      } while (!isPositionFree(newPos!) && attempts < 20);

      if (attempts < 20) setTargetPos(newPos!);
    };

    const getInterval = () => {
      switch (agent.status) {
        case 'idle': return 3000 + Math.random() * 3000;
        case 'working':
        case 'active': return 8000 + Math.random() * 7000;
        case 'thinking': return 15000 + Math.random() * 10000;
        case 'error': return 30000;
        default: return 10000;
      }
    };

    const timeout = setTimeout(getNewTarget, 1000);
    const interval = setInterval(getNewTarget, getInterval());
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [agent.status]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const speed = agent.status === 'idle' ? 1.5 : 0.8;
    const moveSpeed = delta * speed;
    const newPos = currentPos.current.clone().lerp(targetPos, moveSpeed);

    if (isPositionFree(newPos)) {
      currentPos.current.copy(newPos);
      groupRef.current.position.copy(currentPos.current);
      onPositionUpdate(agent.id, currentPos.current.clone());

      const direction = new Vector3().subVectors(targetPos, currentPos.current);
      if (direction.length() > 0.1) {
        groupRef.current.rotation.y = Math.atan2(direction.x, direction.z);
      }
    } else {
      const x = Math.random() * (officeBounds.maxX - officeBounds.minX) + officeBounds.minX;
      const z = Math.random() * (officeBounds.maxZ - officeBounds.minZ) + officeBounds.minZ;
      const newTarget = new Vector3(x, 0.6, z);
      if (isPositionFree(newTarget)) setTargetPos(newTarget);
    }
  });

  const agentConfig = {
    id: agent.id,
    name: agent.name,
    emoji: agent.emoji || '',
    position: agent.position,
    color: agent.color,
    role: agent.role || '',
  };

  return (
    <group ref={groupRef} scale={3}>
      <VoxelAvatar
        agent={agentConfig}
        position={[0, 0, 0]}
        isWorking={agent.status === 'working' || agent.status === 'active'}
        isThinking={agent.status === 'thinking'}
        isError={agent.status === 'error'}
      />
    </group>
  );
}
