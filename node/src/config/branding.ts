export const BRANDING = {
  agentName: process.env.NEXT_PUBLIC_AGENT_NAME || 'SquidJob Node',
  agentEmoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || '🦑',
  agentDescription: process.env.NEXT_PUBLIC_AGENT_DESCRIPTION || 'Local OpenClaw Mission Control',
  appTitle: process.env.NEXT_PUBLIC_APP_TITLE || 'SquidJob Node',
} as const;
