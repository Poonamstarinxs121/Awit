import { NextRequest, NextResponse } from 'next/server';
import { listSessions } from '@/lib/local-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent_id = searchParams.get('agent_id') || undefined;
    const status = searchParams.get('status') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined;

    const result = listSessions({ agent_id, status, from, to, limit, offset });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list sessions' }, { status: 500 });
  }
}
