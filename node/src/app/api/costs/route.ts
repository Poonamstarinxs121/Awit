import { NextRequest, NextResponse } from 'next/server';
import { getCostSummary } from '@/lib/local-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent_id = searchParams.get('agent_id') || undefined;
    const model = searchParams.get('model') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    const summary = getCostSummary({ agent_id, model, from, to });
    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get cost summary' }, { status: 500 });
  }
}
