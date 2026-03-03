export type OfficeAgentStatus = 'idle' | 'working' | 'thinking' | 'error' | 'active' | 'disabled';

export interface OfficeAgent {
  id: string;
  name: string;
  emoji?: string;
  color: string;
  role?: string;
  status: OfficeAgentStatus;
  currentTask?: string;
  model?: string;
  tokensPerHour?: number;
  tasksInQueue?: number;
  uptime?: number;
}

export interface OfficeAgentWithPosition extends OfficeAgent {
  position: [number, number, number];
}

export function mapStatusForOffice(status: string): OfficeAgentStatus {
  switch (status) {
    case 'active':
    case 'working':
      return 'working';
    case 'thinking':
      return 'thinking';
    case 'error':
      return 'error';
    case 'disabled':
      return 'idle';
    case 'idle':
    default:
      return 'idle';
  }
}

const OFFICE_COLORS = [
  '#FF3B30', '#0A84FF', '#32D74B', '#FF9500', '#BF5AF2',
  '#FF375F', '#64D2FF', '#FFD60A', '#30D158', '#5E5CE6',
  '#AC8E68', '#FF6482', '#00C7BE', '#FF9F0A', '#DA5597',
];

export function assignAgentColor(index: number): string {
  return OFFICE_COLORS[index % OFFICE_COLORS.length];
}

export function calculateDeskPositions(agentCount: number): [number, number, number][] {
  if (agentCount === 0) return [];
  if (agentCount === 1) return [[0, 0, 0]];

  const cols = Math.ceil(Math.sqrt(agentCount));
  const rows = Math.ceil(agentCount / cols);
  const spacing = 5;
  const positions: [number, number, number][] = [];

  for (let i = 0; i < agentCount; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = (col - (cols - 1) / 2) * spacing;
    const z = (row - (rows - 1) / 2) * spacing;
    positions.push([x, 0, z]);
  }

  return positions;
}
