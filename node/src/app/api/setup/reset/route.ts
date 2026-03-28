import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearSetupComplete, setSetupConfig } from '@/lib/local-db';
import { validateAuthToken } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST() {
  try {
    const cookieStore = cookies();
    const authCookie = cookieStore.get('node_auth');
    if (!authCookie?.value || !validateAuthToken(authCookie.value)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    clearSetupComplete();
    setSetupConfig('setup_force_rerun', 'true');

    process.env.ADMIN_PASSWORD = 'admin';
    process.env.__SETUP_STANDALONE = '';
    process.env.NODE_HUB_URL = '';
    process.env.NODE_HUB_API_KEY = '';
    process.env.NODE_ID = '';

    const openclawDir = process.env.OPENCLAW_DIR || path.join(os.homedir(), '.openclaw');
    const envLines = [
      '# SquidJob Node Configuration',
      '# Setup reset - run the setup wizard to reconfigure',
      '',
      'ADMIN_PASSWORD=admin',
      `OPENCLAW_DIR=${openclawDir}`,
      '',
    ];

    const nodeDir = path.resolve(process.cwd());
    const envPath = path.join(nodeDir, '.env');
    fs.writeFileSync(envPath, envLines.join('\n'), { mode: 0o600 });

    const response = NextResponse.json({ success: true });
    response.cookies.delete('setup_complete');
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reset setup';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
