import { NextRequest, NextResponse } from 'next/server';
import { readFile, getFileInfo } from '@/lib/filesystem';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'path parameter is required' }, { status: 400 });
  }

  try {
    const content = readFile(filePath);
    const info = getFileInfo(filePath);
    return NextResponse.json({ path: filePath, content, info });
  } catch (err: any) {
    const status = err.message.includes('traversal') || err.message.includes('outside') ? 403
      : err.message.includes('size') ? 413
      : 404;
    return NextResponse.json({ error: err.message }, { status });
  }
}
