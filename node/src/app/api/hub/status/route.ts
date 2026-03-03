import { NextResponse } from 'next/server';
import { getHubStatus } from '@/lib/hub-sync';

export async function GET() {
  const status = getHubStatus();
  return NextResponse.json(status);
}
