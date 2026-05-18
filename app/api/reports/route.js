import { NextResponse } from 'next/server';
import { requireRequestUser } from '@/server/requestAuth.js';
import { getSupabaseAdmin } from '@/server/supabaseAdmin.js';

export const runtime = 'nodejs';

function normalizeSelectedFlags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function normalizeEntityType(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'post') return 'feedback';
  return normalized;
}

function buildReason(reason, selectedFlags) {
  const normalizedReason = String(reason ?? '').trim();
  if (normalizedReason) return normalizedReason;
  if (selectedFlags.length === 1) return selectedFlags[0];
  if (selectedFlags.length > 1) return `${selectedFlags.length} flags selected`;
  return 'Report submitted';
}

function buildDescription(description, selectedFlags) {
  const normalizedDescription = String(description ?? '').trim();
  if (normalizedDescription) return normalizedDescription;
  if (!selectedFlags.length) return null;
  return `Selected flags: ${selectedFlags.join(', ')}`;
}

function buildMissingTableMessage(error) {
  const message = String(error?.message ?? '').toLowerCase();
  const isMissingTable = message.includes('relation')
    || message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find');
  const isMissingSelectedFlagsColumn = message.includes('selected_flags') && message.includes('column');

  if (!isMissingTable && !isMissingSelectedFlagsColumn) return null;
  return 'Reports table is not installed yet. Run citizen-web/scripts/create_reports_table.sql in Supabase SQL Editor.';
}

export async function POST(request) {
  const auth = await requireRequestUser(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const entityType = normalizeEntityType(body.entityType);
  const entityId = String(body.entityId ?? '').trim();
  const selectedFlags = normalizeSelectedFlags(body.selectedFlags);
  const reason = buildReason(body.reason, selectedFlags);
  const description = buildDescription(body.description, selectedFlags);

  if (!entityType) {
    return NextResponse.json({ error: 'Entity type is required.' }, { status: 400 });
  }

  if (!entityId) {
    return NextResponse.json({ error: 'Entity id is required.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 500 });
  }

  const insertResult = await admin
    .from('reports')
    .insert({
      reporter_id: auth.user.id,
      reported_entity_type: entityType,
      reported_entity_id: entityId,
      reason,
      description,
      selected_flags: selectedFlags,
    })
    .select('id, reporter_id, reported_entity_type, reported_entity_id, reason, description, selected_flags, created_at')
    .maybeSingle();

  if (!insertResult.error && insertResult.data) {
    return NextResponse.json({
      ...insertResult.data,
      duplicate: false,
    });
  }

  if (insertResult.error?.code === '23505') {
    return NextResponse.json({
      duplicate: true,
      reporter_id: auth.user.id,
      reported_entity_type: entityType,
      reported_entity_id: entityId,
      reason,
      description,
      selected_flags: selectedFlags,
    });
  }

  const missingTableMessage = buildMissingTableMessage(insertResult.error);
  if (missingTableMessage) {
    return NextResponse.json({ error: missingTableMessage }, { status: 500 });
  }

  return NextResponse.json(
    { error: insertResult.error?.message ?? 'Unable to create report.' },
    { status: 500 },
  );
}
