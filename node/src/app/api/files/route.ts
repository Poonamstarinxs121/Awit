import { NextRequest, NextResponse } from 'next/server';
import { listDir } from '@/lib/filesystem';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dirPath = searchParams.get('path') || '.';

  try {
    const entries = listDir(dirPath);
    return NextResponse.json({ path: dirPath, entries });
  } catch (err: any) {
    const status = err.message.includes('traversal') || err.message.includes('outside') ? 403 : 404;
    return NextResponse.json({ error: err.message }, { status });
  }
}
