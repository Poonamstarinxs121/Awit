import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isSetupComplete, getSetupConfig } from '@/lib/local-db';
import { validateAuthToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const alreadyComplete = isSetupComplete();
    const forceRerun = getSetupConfig('setup_force_rerun') === 'true';
    if (alreadyComplete && !forceRerun) {
      const cookieStore = cookies();
      const authCookie = cookieStore.get('node_auth');
      if (!authCookie?.value || !validateAuthToken(authCookie.value)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { hubUrl, apiKey, nodeId } = await req.json();

    if (!hubUrl || !apiKey || !nodeId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(hubUrl);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid Hub URL format' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ success: false, error: 'Hub URL must use http or https' }, { status: 400 });
    }

    const cleanUrl = hubUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/v1/nodes/${encodeURIComponent(nodeId)}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        cpu_percent: 0,
        memory_percent: 0,
        disk_percent: 0,
        uptime_seconds: 0,
        agent_statuses: [],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      return NextResponse.json({ success: true, message: 'Connected successfully' });
    }

    const status = res.status;
    let error = 'Connection failed';
    if (status === 401 || status === 403) error = 'Invalid API key or unauthorized';
    else if (status === 404) error = 'Node ID not found on Hub';
    else error = `Hub returned status ${status}`;

    return NextResponse.json({ success: false, error });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message?.includes('timeout') ? 'Connection timed out' :
                    err instanceof Error && err.message?.includes('fetch') ? 'Could not reach Hub URL' :
                    'Connection failed';
    return NextResponse.json({ success: false, error: message });
  }
}
