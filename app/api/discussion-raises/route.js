import { NextResponse } from 'next/server';
import { requireRequestUser } from '@/server/requestAuth.js';
import { getSupabaseAdmin } from '@/server/supabaseAdmin.js';

export const runtime = 'nodejs';

function normalizeSourceTable(value) {
  return value === 'comments' ? 'comments' : 'discussions';
}

function buildMissingTableMessage(error) {
  const message = String(error?.message ?? '').toLowerCase();
  const isMissingTable = message.includes('relation')
    || message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find');

  if (!isMissingTable) return null;
  return 'Discussion raise tables are not installed yet. Run citizen-web/scripts/create_reports_table.sql in Supabase SQL Editor.';
}

async function syncLikesCount(admin, sourceTable, entryId) {
  const countResult = await admin
    .from('discussion_raises')
    .select('id', { count: 'exact', head: true })
    .eq('entry_id', entryId)
    .eq('source_table', sourceTable);

  if (countResult.error) return { data: null, error: countResult.error };

  const likesCount = countResult.count ?? 0;
  const updateResult = await admin
    .from(sourceTable)
    .update({ likes_count: likesCount })
    .eq('id', entryId)
    .select('id, likes_count')
    .maybeSingle();

  if (updateResult.error) return { data: null, error: updateResult.error };

  return {
    data: {
      ...(updateResult.data ?? {}),
      likes_count: likesCount,
      raised: true,
    },
    error: null,
  };
}

async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request) {
  const auth = await requireRequestUser(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await parseBody(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const entryId = String(body.entryId ?? '').trim();
  const sourceTable = normalizeSourceTable(body.sourceTable);
  if (!entryId) {
    return NextResponse.json({ error: 'Entry id is required.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 500 });
  }

  const insertResult = await admin
    .from('discussion_raises')
    .insert({
      user_id: auth.user.id,
      entry_id: entryId,
      source_table: sourceTable,
    });

  if (insertResult.error && insertResult.error.code !== '23505') {
    const missingTableMessage = buildMissingTableMessage(insertResult.error);
    if (missingTableMessage) {
      return NextResponse.json({ error: missingTableMessage }, { status: 500 });
    }
    return NextResponse.json({ error: insertResult.error.message ?? 'Unable to raise discussion.' }, { status: 500 });
  }

  const synced = await syncLikesCount(admin, sourceTable, entryId);
  if (synced.error) {
    const missingTableMessage = buildMissingTableMessage(synced.error);
    if (missingTableMessage) {
      return NextResponse.json({ error: missingTableMessage }, { status: 500 });
    }
    return NextResponse.json({ error: synced.error.message ?? 'Unable to update raise count.' }, { status: 500 });
  }

  return NextResponse.json({
    ...synced.data,
    raised: true,
  });
}

export async function DELETE(request) {
  const auth = await requireRequestUser(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await parseBody(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const entryId = String(body.entryId ?? '').trim();
  const sourceTable = normalizeSourceTable(body.sourceTable);
  if (!entryId) {
    return NextResponse.json({ error: 'Entry id is required.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 500 });
  }

  const deleteResult = await admin
    .from('discussion_raises')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('entry_id', entryId)
    .eq('source_table', sourceTable);

  if (deleteResult.error) {
    const missingTableMessage = buildMissingTableMessage(deleteResult.error);
    if (missingTableMessage) {
      return NextResponse.json({ error: missingTableMessage }, { status: 500 });
    }
    return NextResponse.json({ error: deleteResult.error.message ?? 'Unable to remove raise.' }, { status: 500 });
  }

  const synced = await syncLikesCount(admin, sourceTable, entryId);
  if (synced.error) {
    const missingTableMessage = buildMissingTableMessage(synced.error);
    if (missingTableMessage) {
      return NextResponse.json({ error: missingTableMessage }, { status: 500 });
    }
    return NextResponse.json({ error: synced.error.message ?? 'Unable to update raise count.' }, { status: 500 });
  }

  return NextResponse.json({
    ...synced.data,
    raised: false,
  });
}
