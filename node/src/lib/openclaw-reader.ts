import fs from 'fs';
import path from 'path';
import { NODE_CONFIG } from '../config/node';

export interface OpenClawAgent {
  id: string;
  name: string;
  workspace: string;
  model?: string;
  status: 'active' | 'idle' | 'unknown';
}

export interface AgentFiles {
  soul?: string;
  agents?: string;
  tools?: string;
  memory?: string;
  heartbeat?: string;
  identity?: string;
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      model?: { primary?: string };
      workspace?: string;
    };
    list?: Array<{ id: string; model?: { primary?: string }; workspace?: string }>;
  };
  gateway?: {
    port?: number;
  };
  [key: string]: any;
}

export function readOpenClawConfig(): OpenClawConfig | null {
  const configPath = path.join(NODE_CONFIG.openclawDir, 'openclaw.json');
  try {
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function discoverAgents(): OpenClawAgent[] {
  const config = readOpenClawConfig();
  if (!config?.agents?.list) return [];

  const defaultWorkspace = config.agents.defaults?.workspace || path.join(NODE_CONFIG.openclawDir, 'workspace');
  const defaultModel = config.agents.defaults?.model?.primary || '';

  return config.agents.list.map(agent => {
    const agentId = agent.id;
    let workspace = defaultWorkspace;
    if (agent.workspace) {
      workspace = agent.workspace;
    } else if (agentId !== 'main') {
      workspace = path.join(path.dirname(defaultWorkspace), `workspace-${agentId}`);
    }

    return {
      id: agentId,
      name: agentId.charAt(0).toUpperCase() + agentId.slice(1),
      workspace,
      model: agent.model?.primary || defaultModel,
      status: fs.existsSync(workspace) ? 'active' : 'unknown',
    };
  });
}

export function readAgentFiles(agentId: string): AgentFiles {
  const agents = discoverAgents();
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return {};

  const workspace = agent.workspace;
  const files: AgentFiles = {};
  const fileMap: Record<keyof AgentFiles, string> = {
    soul: 'SOUL.md',
    agents: 'AGENTS.md',
    tools: 'TOOLS.md',
    memory: 'MEMORY.md',
    heartbeat: 'HEARTBEAT.md',
    identity: 'IDENTITY.md',
  };

  for (const [key, filename] of Object.entries(fileMap)) {
    const filePath = path.join(workspace, filename);
    try {
      if (fs.existsSync(filePath)) {
        files[key as keyof AgentFiles] = fs.readFileSync(filePath, 'utf-8');
      }
    } catch {}
  }

  return files;
}

export function getGatewayPort(): number {
  const config = readOpenClawConfig();
  return config?.gateway?.port || 18789;
}
