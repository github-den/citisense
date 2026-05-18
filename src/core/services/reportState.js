import { supabase } from '@core/lib/supabase.js';

function isSchemaMismatch(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('relation') ||
    message.includes('column') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

async function resolveUserId(currentUserId = null) {
  if (currentUserId) return currentUserId;
  if (!supabase) return null;

  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export async function fetchUserReportedPostIds(postIds = [], currentUserId = null) {
  if (!supabase || postIds.length === 0) return new Set();

  const resolvedUserId = await resolveUserId(currentUserId);
  if (!resolvedUserId || String(resolvedUserId).startsWith('demo-')) return new Set();

  const normalizedIds = [...new Set(postIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (normalizedIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('reports')
    .select('reported_entity_id, reported_entity_type')
    .eq('reporter_id', resolvedUserId)
    .in('reported_entity_type', ['feedback', 'post'])
    .in('reported_entity_id', normalizedIds);

  if (error) {
    if (!isSchemaMismatch(error)) {
      console.error('Error fetching reported post ids:', error);
    }
    return new Set();
  }

  return new Set(
    (data ?? [])
      .map((row) => String(row.reported_entity_id ?? '').trim())
      .filter(Boolean),
  );
}

export async function fetchUserReportedEntityKeys(entries = [], currentUserId = null) {
  if (!supabase || entries.length === 0) return new Set();

  const resolvedUserId = await resolveUserId(currentUserId);
  if (!resolvedUserId || String(resolvedUserId).startsWith('demo-')) return new Set();

  const normalizedEntries = [...new Map(
    entries
      .map((entry) => {
        const entityId = String(entry?.id ?? '').trim();
        const entityType = String(entry?.entityType ?? '').trim().toLowerCase();
        if (!entityId || !entityType) return null;
        return [`${entityType}:${entityId}`, { entityId, entityType }];
      })
      .filter(Boolean),
  ).values()];

  if (normalizedEntries.length === 0) return new Set();

  const entityIds = [...new Set(normalizedEntries.map((entry) => entry.entityId))];
  const entityTypes = [...new Set(normalizedEntries.map((entry) => entry.entityType))];

  const { data, error } = await supabase
    .from('reports')
    .select('reported_entity_id, reported_entity_type')
    .eq('reporter_id', resolvedUserId)
    .in('reported_entity_type', entityTypes)
    .in('reported_entity_id', entityIds);

  if (error) {
    if (!isSchemaMismatch(error)) {
      console.error('Error fetching reported entity keys:', error);
    }
    return new Set();
  }

  return new Set(
    (data ?? [])
      .map((row) => `${String(row.reported_entity_type ?? '').trim().toLowerCase()}:${String(row.reported_entity_id ?? '').trim()}`)
      .filter(Boolean),
  );
}

export function attachReportedByMe(rows = [], reportedIds = new Set()) {
  return rows.map((row) => ({
    ...row,
    reportedByMe: reportedIds.has(String(row?.id ?? '')),
  }));
}
