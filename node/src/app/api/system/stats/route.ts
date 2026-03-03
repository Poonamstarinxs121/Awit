import { NextResponse } from 'next/server';
import { getSystemStats } from '@/lib/system-monitor';

export async function GET() {
  const stats = getSystemStats();
  return NextResponse.json(stats);
}
