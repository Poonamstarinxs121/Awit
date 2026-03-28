import { NextResponse } from 'next/server';
import { isSetupComplete, setSetupConfig, getSetupConfig } from '@/lib/local-db';

function isConfiguredViaEnv(): boolean {
  const hasPassword = !!(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== 'admin');
  const hasHub = !!(process.env.NODE_HUB_URL && process.env.NODE_HUB_API_KEY && process.env.NODE_ID);
  const isStandalone = process.env.__SETUP_STANDALONE === 'true';

  return hasPassword && (hasHub || isStandalone);
}

export async function GET() {
  try {
    const forceRerun = getSetupConfig('setup_force_rerun') === 'true';
    if (forceRerun) {
      return NextResponse.json({ setupComplete: false });
    }

    const dbComplete = isSetupComplete();
    const envConfigured = isConfiguredViaEnv();

    if (envConfigured && !dbComplete) {
      setSetupConfig('setup_complete', 'true');
      const hasHub = !!(process.env.NODE_HUB_URL && process.env.NODE_HUB_API_KEY && process.env.NODE_ID);
      setSetupConfig('standalone', hasHub ? 'false' : 'true');
    }

    const complete = dbComplete || envConfigured;
    return NextResponse.json({ setupComplete: complete });
  } catch {
    return NextResponse.json({ setupComplete: false });
  }
}
