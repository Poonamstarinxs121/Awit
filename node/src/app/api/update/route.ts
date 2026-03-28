// update/route.ts v1.0.0
import { NextRequest, NextResponse } from 'next/server';
import {
  getUpdateStatus,
  checkLatestVersion,
  startUpdate,
  rollback,
  resetUpdateState,
} from '@/lib/update-manager';

export async function GET() {
  try {
    const status = getUpdateStatus();
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === 'check') {
      const latest = await checkLatestVersion();
      const status = getUpdateStatus();
      return NextResponse.json({ ...status, latestVersion: latest });
    }

    if (action === 'start') {
      const { downloadUrl } = body;
      const result = await startUpdate(downloadUrl);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: 'Update started' });
    }

    if (action === 'rollback') {
      const result = rollback();
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: 'Rollback complete' });
    }

    if (action === 'reset') {
      resetUpdateState();
      return NextResponse.json({ ok: true, message: 'Update state reset' });
    }

    return NextResponse.json({ error: 'Unknown action. Use: check, start, rollback, reset' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
