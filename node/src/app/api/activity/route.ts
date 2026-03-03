import { NextRequest, NextResponse } from 'next/server';
import { listActivity } from '@/lib/local-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent_id = searchParams.get('agent_id') || undefined;
    const event_type = searchParams.get('event_type') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined;

    const result = listActivity({ agent_id, event_type, limit, offset });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list activity' }, { status: 500 });
  }
}
