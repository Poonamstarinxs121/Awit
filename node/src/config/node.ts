import path from 'path';
import os from 'os';

export const NODE_CONFIG = {
  get openclawDir() { return process.env.OPENCLAW_DIR || path.join(os.homedir(), '.openclaw'); },
  get hubUrl() { return process.env.NODE_HUB_URL || ''; },
  get hubApiKey() { return process.env.NODE_HUB_API_KEY || ''; },
  get nodeId() { return process.env.NODE_ID || ''; },
  get nodeName() { return process.env.NODE_NAME || os.hostname(); },
  get adminPassword() { return process.env.ADMIN_PASSWORD || 'admin'; },
};

export function isHubConfigured(): boolean {
  return !!(NODE_CONFIG.hubUrl && NODE_CONFIG.hubApiKey && NODE_CONFIG.nodeId);
}
