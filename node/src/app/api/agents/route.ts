import { NextResponse } from 'next/server';
import { discoverAgents } from '@/lib/openclaw-reader';

export async function GET() {
  const agents = discoverAgents();
  return NextResponse.json({ agents });
}
