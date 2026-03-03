import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/local-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30';
    const days = parseInt(range, 10);
    const agent_id = searchParams.get('agent_id') || undefined;

    const db = getDb();

    const conditions: string[] = [`date(recorded_at) >= date('now', '-${days} days')`];
    const params: Record<string, unknown> = {};

    if (agent_id) {
      conditions.push('agent_id = @agent_id');
      params.agent_id = agent_id;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const stmt = db.prepare(`
      SELECT date(recorded_at) as date,
             SUM(estimated_cost) as total_cost,
             SUM(tokens_in) as total_tokens_in,
             SUM(tokens_out) as total_tokens_out,
             COUNT(*) as record_count
      FROM costs
      ${where}
      GROUP BY date(recorded_at)
      ORDER BY date ASC
    `);

    const daily = stmt.all(params);

    return NextResponse.json({ daily, range: days });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get daily costs' }, { status: 500 });
  }
}
