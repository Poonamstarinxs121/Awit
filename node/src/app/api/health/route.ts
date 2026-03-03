import { NextResponse } from 'next/server';
import { getSystemStats } from '@/lib/system-monitor';
import { readOpenClawConfig, discoverAgents } from '@/lib/openclaw-reader';

export async function GET() {
  const stats = getSystemStats();
  const config = readOpenClawConfig();
  const agents = discoverAgents();

  return NextResponse.json({
    status: 'ok',
    version: '0.1.0',
    system: stats,
    openclaw: {
      configured: !!config,
      agent_count: agents.length,
    },
  });
}
