import { NextResponse } from 'next/server';
import { getLocalDispatchHistory } from '../../../lib/dispatch-worker';

export async function GET() {
  try {
    const history = getLocalDispatchHistory();
    return NextResponse.json({ dispatches: history, total: history.length });
  } catch (error) {
    console.error('List dispatches error:', error);
    return NextResponse.json({ error: 'Failed to list dispatches' }, { status: 500 });
  }
}
