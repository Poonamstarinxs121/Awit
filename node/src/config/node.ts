import path from 'path';
import os from 'os';

export const NODE_CONFIG = {
  openclawDir: process.env.OPENCLAW_DIR || path.join(os.homedir(), '.openclaw'),
  hubUrl: process.env.NODE_HUB_URL || '',
  hubApiKey: process.env.NODE_HUB_API_KEY || '',
  nodeId: process.env.NODE_ID || '',
  nodeName: process.env.NODE_NAME || os.hostname(),
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
};

export function isHubConfigured(): boolean {
  return !!(NODE_CONFIG.hubUrl && NODE_CONFIG.hubApiKey && NODE_CONFIG.nodeId);
}
