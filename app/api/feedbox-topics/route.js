import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { getTopicFeedboxes } = await import('../../../src/server/feedboxTopics.js');
    const url = new URL(request.url);
    const refresh = url.searchParams.get('refresh') === '1';
    const feedboxes = await getTopicFeedboxes({ forceRefresh: refresh });
    return NextResponse.json({ feedboxes });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message ?? 'Unable to load topic feedboxes.' },
      { status: 500 },
    );
  }
}
