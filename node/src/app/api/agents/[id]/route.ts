import { NextResponse } from 'next/server';
import { discoverAgents, readAgentFiles } from '@/lib/openclaw-reader';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const agents = discoverAgents();
  const agent = agents.find(a => a.id === params.id);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const files = readAgentFiles(params.id);

  return NextResponse.json({
    agent,
    files,
  });
}
