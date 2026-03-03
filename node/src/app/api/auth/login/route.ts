import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { NODE_CONFIG } from '@/config/node';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (!password || password !== NODE_CONFIG.adminPassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = Buffer.from(`${Date.now()}:${NODE_CONFIG.nodeName}`).toString('base64');

    const cookieStore = cookies();
    cookieStore.set('node_auth', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
