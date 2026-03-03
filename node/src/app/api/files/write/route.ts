import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from '@/lib/filesystem';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: filePath, content } = body;

    if (!filePath || typeof content !== 'string') {
      return NextResponse.json({ error: 'path and content are required' }, { status: 400 });
    }

    writeFile(filePath, content);
    return NextResponse.json({ success: true, path: filePath });
  } catch (err: any) {
    const status = err.message.includes('traversal') || err.message.includes('outside') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
