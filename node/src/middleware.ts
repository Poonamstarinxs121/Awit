import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateAuthTokenEdge } from '@/lib/auth-edge';

const PUBLIC_PATHS = ['/setup', '/api/setup/status', '/api/health', '/_next', '/favicon.ico'];
const AUTH_EXEMPT_PATHS = ['/login', '/api/auth/login'];

function isSetupRequired(): boolean {
  const hasPassword = !!(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== 'admin');
  const hasHub = !!(process.env.NODE_HUB_URL && process.env.NODE_HUB_API_KEY && process.env.NODE_ID);
  const standaloneFlag = process.env.__SETUP_STANDALONE === 'true';

  return !(hasPassword && (hasHub || standaloneFlag));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const setupNeeded = isSetupRequired();
  const authCookie = request.cookies.get('node_auth')?.value || '';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
  const nodeName = process.env.NODE_NAME || '';
  const isAuthenticated = authCookie ? await validateAuthTokenEdge(authCookie, adminPassword, nodeName) : false;

  if (pathname.startsWith('/api/setup/')) {
    if (setupNeeded || isAuthenticated) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (setupNeeded) {
    const url = request.nextUrl.clone();
    url.pathname = '/setup';
    return NextResponse.redirect(url);
  }

  if (AUTH_EXEMPT_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
