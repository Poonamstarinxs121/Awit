import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/local-db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(parseInt(params.id, 10));

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get session' }, { status: 500 });
  }
}
