import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/server/supabaseAdmin.js';
import { geminiText, parseJsonFromGemini } from '@/server/gemini.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOPIC_CACHE_TTL_MS = 5 * 60 * 1000;
const topicCache = new Map();

function isSchemaMismatch(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('relation') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('column')
  );
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cacheKey(topicTitle, keywords = []) {
  const key = `${String(topicTitle ?? '').trim().toLowerCase()}|${(keywords ?? []).map((k) => String(k).trim().toLowerCase()).filter(Boolean).join(',')}`;
  return key;
}

function getCachedPosts(key) {
  const hit = topicCache.get(key);
  if (!hit) return null;
  if ((Date.now() - hit.createdAt) > TOPIC_CACHE_TTL_MS) {
    topicCache.delete(key);
    return null;
  }
  return hit.posts ?? null;
}

function setCachedPosts(key, posts) {
  topicCache.set(key, { createdAt: Date.now(), posts });
}

async function fetchRecentCaptionCandidates(admin) {
  const primary = await admin
    .from('posts')
    .select('id, caption')
    .order('created_at', { ascending: false })
    .limit(200);

  if (!primary.error) return { table: 'posts', rows: primary.data ?? [] };
  if (!isSchemaMismatch(primary.error)) throw primary.error;

  const fallback = await admin
    .from('feedbacks')
    .select('id, caption')
    .order('created_at', { ascending: false })
    .limit(200);

  if (fallback.error) throw fallback.error;
  return { table: 'feedbacks', rows: fallback.data ?? [] };
}

async function fetchFullRowsByIds(admin, table, ids) {
  if (!ids.length) return [];

  if (table === 'posts') {
    const { data, error } = await admin
      .from('posts')
      .select('id, caption, created_at, users(username, avatar_url)')
      .in('id', ids);
    if (!error) return data ?? [];
    if (!isSchemaMismatch(error)) throw error;
  }

  const { data, error } = await admin
    .from('feedbacks')
    .select(`
      id, user_id, caption, type, status, service,
      location:incident_location, feedback_no, raises_count, discuss_count,
      reacts_count, created_at, image_url, image_urls,
      profiles ( username, avatar )
    `)
    .in('id', ids);

  if (error) throw error;
  return data ?? [];
}

function reorderById(rows, idOrder) {
  const map = new Map(rows.map((r) => [String(r.id), r]));
  return idOrder.map((id) => map.get(String(id))).filter(Boolean);
}

async function fetchMappedIdsForTopic(admin, topicTitle) {
  const topicLookup = await admin
    .from('topic_feedbox')
    .select('id, title')
    .eq('title', topicTitle)
    .maybeSingle();

  if (topicLookup.error || !topicLookup.data?.id) {
    return { topicId: null, ids: [] };
  }

  const { data, error } = await admin
    .from('topic_feedbox_posts')
    .select('post_id, rank')
    .eq('topic_id', topicLookup.data.id)
    .order('rank', { ascending: true })
    .limit(30);

  if (error) return { topicId: topicLookup.data.id, ids: [] };
  const ids = (data ?? []).map((r) => String(r.post_id)).filter(Boolean);
  return { topicId: topicLookup.data.id, ids };
}

export async function POST(request) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const topicTitle = String(body?.topicTitle ?? '').trim();
  const keywords = Array.isArray(body?.keywords) ? body.keywords.map(String) : [];
  if (!topicTitle) {
    return NextResponse.json({ error: 'topicTitle is required.' }, { status: 400 });
  }

  try {
    const key = cacheKey(topicTitle, keywords);
    const cached = getCachedPosts(key);
    if (cached) {
      return NextResponse.json({ posts: cached, cached: true });
    }

    // Fast path: if cron already mapped posts for this topic, just fetch them.
    try {
      const mapped = await fetchMappedIdsForTopic(admin, topicTitle);
      if (mapped.ids.length > 0) {
        const { table } = await fetchRecentCaptionCandidates(admin);
        const full = await fetchFullRowsByIds(admin, table, mapped.ids);
        const sorted = reorderById(full, mapped.ids);
        setCachedPosts(key, sorted);
        return NextResponse.json({ posts: sorted, source: 'mapped' });
      }
    } catch {
      // ignore and continue to Gemini fallback
    }

    const { table, rows } = await fetchRecentCaptionCandidates(admin);
    const allCandidates = (rows ?? []).filter((r) => r?.id && r?.caption);
    const normalizedKeywords = keywords.map(normalizeText).filter(Boolean);
    const prefiltered = normalizedKeywords.length > 0
      ? allCandidates.filter((row) => {
          const text = normalizeText(row.caption);
          return normalizedKeywords.some((kw) => text.includes(kw));
        })
      : allCandidates;
    const candidates = (prefiltered.length > 0 ? prefiltered : allCandidates).slice(0, 140);

    const prompt = [
      `Topic: "${topicTitle}"`,
      `Keywords: ${keywords.filter(Boolean).join(', ')}`,
      '',
      'Mula sa mga post na ito, piliin ang mga may KAUGNAYAN sa topic — kahit hindi eksaktong kapareho ng salita, basta connected ang tema.',
      '',
      'Posts:',
      ...candidates.map((row) => `ID:${row.id} | ${String(row.caption ?? '').replace(/\s+/g, ' ').trim()}`),
      '',
      'Sumagot LAMANG ng JSON array ng mga relevant post IDs, sorted by relevance:',
      '["id1", "id2", ...]',
      '',
      'Maximum 30 posts lang. Kung walang relevant, ibalik ang empty array [].',
    ].join('\n');

    let ids = [];
    try {
      const text = await geminiText({ model: 'gemini-2.5-flash', prompt });
      const parsed = parseJsonFromGemini(text);
      ids = Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 30) : [];
    } catch (error) {
      return NextResponse.json({ error: error?.message ?? 'Gemini matching failed.' }, { status: 500 });
    }

    const full = await fetchFullRowsByIds(admin, table, ids);
    const sorted = reorderById(full, ids);
    setCachedPosts(key, sorted);
    return NextResponse.json({ posts: sorted });
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? 'Unable to match posts by topic.' }, { status: 500 });
  }
}

