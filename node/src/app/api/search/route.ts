import { NextRequest, NextResponse } from 'next/server';
import { localSearch } from '@/lib/local-search';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const { results } = localSearch(query);
    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    );
  }
}
