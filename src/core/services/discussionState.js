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

function countRowsByPost(rows = [], counts = new Map()) {
  (rows ?? []).forEach((row) => {
    const postId = String(row?.post_id ?? '').trim();
    if (!postId) return;
    counts.set(postId, (counts.get(postId) ?? 0) + 1);
  });
  return counts;
}

async function fetchTopLevelRows(table, postIds) {
  if (!supabase || postIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(table)
    .select('id, post_id')
    .is('parent_id', null)
    .in('post_id', postIds);

  return { data: data ?? [], error };
}

export async function fetchTopLevelDiscussionCountMap(postIds = []) {
  if (!supabase || postIds.length === 0) return new Map();

  const normalizedIds = [...new Set(postIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
  const counts = new Map();
  const chunkSize = 200;

  for (let index = 0; index < normalizedIds.length; index += chunkSize) {
    const chunk = normalizedIds.slice(index, index + chunkSize);

    const discussionsResult = await fetchTopLevelRows('discussions', chunk);
    if (!discussionsResult.error) {
      countRowsByPost(discussionsResult.data, counts);
    } else if (!isSchemaMismatch(discussionsResult.error)) {
      console.error('Error fetching discussion counts:', discussionsResult.error);
    }

    const commentsResult = await fetchTopLevelRows('comments', chunk);
    if (!commentsResult.error) {
      countRowsByPost(commentsResult.data, counts);
    } else if (!isSchemaMismatch(commentsResult.error)) {
      console.error('Error fetching legacy discussion counts:', commentsResult.error);
    }
  }

  return counts;
}

export function attachTopLevelDiscussionCounts(rows = [], countMap = new Map()) {
  return rows.map((row) => ({
    ...row,
    discuss_count: countMap.get(String(row?.id ?? '')) ?? 0,
  }));
}
