import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getSupabaseAdmin } from '@/server/supabaseAdmin.js';
import { geminiText, parseJsonFromGemini } from '@/server/gemini.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// If `topic_feedbox` table does not exist, create it with:
// create extension if not exists pgcrypto;
// create table if not exists public.topic_feedbox (
//   id uuid primary key default gen_random_uuid(),
//   title text not null,
//   keywords text[] not null default '{}',
//   score int not null default 0,
//   rank int not null,
//   created_at timestamptz not null default now()
// );
//
// And the join table for fast topic -> posts lookup:
// create table if not exists public.topic_feedbox_posts (
//   topic_id uuid not null references public.topic_feedbox(id) on delete cascade,
//   post_id uuid not null,
//   rank int not null,
//   created_at timestamptz not null default now(),
//   primary key (topic_id, post_id)
// );
// create index if not exists idx_topic_feedbox_posts_topic_rank on public.topic_feedbox_posts(topic_id, rank);

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

async function fetchRecentCaptions(admin, limit = 100) {
  const primary = await admin
    .from('posts')
    .select('caption')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!primary.error) return (primary.data ?? []).map((r) => r.caption).filter(Boolean);
  if (!isSchemaMismatch(primary.error)) throw primary.error;

  const fallback = await admin
    .from('feedbacks')
    .select('caption')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []).map((r) => r.caption).filter(Boolean);
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchRecentPostCandidates(admin, limit = 100) {
  const primary = await admin
    .from('posts')
    .select('id, caption')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!primary.error) return { table: 'posts', rows: primary.data ?? [] };
  if (!isSchemaMismatch(primary.error)) throw primary.error;

  const fallback = await admin
    .from('feedbacks')
    .select('id, caption')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fallback.error) throw fallback.error;
  return { table: 'feedbacks', rows: fallback.data ?? [] };
}

function scorePostForTopic({ caption, title, keywords }) {
  const text = normalizeText(caption);
  if (!text) return 0;

  const titleKey = normalizeText(title);
  const keys = [titleKey, ...(Array.isArray(keywords) ? keywords : [])]
    .map(normalizeText)
    .filter(Boolean)
    .slice(0, 10);

  let score = 0;
  for (const key of keys) {
    if (key && text.includes(key)) score += (key === titleKey ? 3 : 2);
  }
  return score;
}

export async function GET() {
  const configuredSecret = process.env.CRON_SECRET;
  if (configuredSecret) {
    const requestHeaders = await headers();
    const providedSecret = requestHeaders.get('x-cron-secret') ?? '';
    if (!providedSecret || providedSecret !== configuredSecret) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase service role is not configured.' }, { status: 500 });
  }

  try {
    const { rows: recentPosts } = await fetchRecentPostCandidates(admin, 100);
    const captions = (recentPosts ?? []).map((r) => r.caption).filter(Boolean);
    const prompt = [
      'Ikaw ay isang social media trend analyst. Basahin ang mga caption na ito mula sa isang Filipino social media app.',
      '',
      'Gumawa ng LAHAT ng possible trending topic titles na:',
      '- Nakasulat sa Filipino/Taglish',
      '- Parang controversial news headline — maikli, matindi, nakaka-engganyo basahin',
      '- Halimbawa: "Basura sa Anonas", "Bastos na employee sa Makati", "Traffic ulit sa EDSA"',
      '- HINDI dapat exact na kopya ng caption — ibagay mo lang ang tema',
      '- Pwede higit 10 topics kung maraming distinct themes',
      '',
      'Captions:',
      ...(captions.length ? captions.map((c, i) => `${i + 1}. ${String(c).replace(/\s+/g, ' ').trim()}`) : ['1. (no captions)']),
      '',
      'Sumagot LAMANG ng JSON array, walang ibang text:',
      '[',
      '  { "title": "...", "keywords": ["keyword1", "keyword2"], "score": 95 },',
      '  ...',
      ']',
      '',
      'I-rank mula pinaka-trending (mataas na score) pababa.',
    ].join('\n');

    let topics;
    try {
      const text = await geminiText({ model: 'gemini-2.5-flash', prompt });
      const parsed = parseJsonFromGemini(text);
      topics = Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      return NextResponse.json({ error: error?.message ?? 'Gemini topic generation failed.' }, { status: 500 });
    }

    if (!topics) {
      return NextResponse.json({ error: 'Gemini returned an invalid payload.' }, { status: 500 });
    }

    const del = await admin.from('topic_feedbox').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (del.error) {
      return NextResponse.json({ error: del.error.message }, { status: 500 });
    }

    const now = new Date().toISOString();
    const rows = topics.map((item, index) => ({
      title: String(item?.title ?? '').trim(),
      keywords: Array.isArray(item?.keywords) ? item.keywords.map(String).filter(Boolean) : [],
      score: Number(item?.score ?? 0),
      rank: index + 1,
      created_at: now,
    })).filter((row) => row.title);

    const inserted = await admin
      .from('topic_feedbox')
      .insert(rows)
      .select('id, title, keywords, rank');
    if (inserted.error) {
      return NextResponse.json({ error: inserted.error.message }, { status: 500 });
    }

    // Clear mapping table (if present)
    const delMap = await admin
      .from('topic_feedbox_posts')
      .delete()
      .gte('rank', 0);
    if (delMap.error && !isSchemaMismatch(delMap.error)) {
      return NextResponse.json({ error: delMap.error.message }, { status: 500 });
    }

    const insertedTopics = inserted.data ?? [];
    const mappingRows = [];

    for (const topic of insertedTopics) {
      const scored = (recentPosts ?? [])
        .filter((p) => p?.id && p?.caption)
        .map((p) => ({
          id: String(p.id),
          score: scorePostForTopic({ caption: p.caption, title: topic.title, keywords: topic.keywords }),
        }))
        .filter((p) => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);

      scored.forEach((post, index) => {
        mappingRows.push({
          topic_id: topic.id,
          post_id: post.id,
          rank: index + 1,
          created_at: now,
        });
      });
    }

    if (mappingRows.length > 0) {
      const mapInsert = await admin.from('topic_feedbox_posts').insert(mappingRows);
      if (mapInsert.error) {
        return NextResponse.json({ error: mapInsert.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? 'Unable to generate trending topics.' }, { status: 500 });
  }
}

