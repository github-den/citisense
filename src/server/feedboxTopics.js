import { createStructuredResponse } from './openaiStructured.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_VISIBLE_FEEDBACKS = 3;

const TOPIC_CLUSTER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['clusters'],
  properties: {
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'feedbackIds', 'keywords'],
        properties: {
          topic: { type: 'string' },
          feedbackIds: { type: 'array', items: { type: 'string' } },
          keywords: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const STOP_WORDS = new Set([
  'ang', 'mga', 'yung', 'itong', 'iyon', 'iyan', 'dito', 'doon', 'lang', 'naman',
  'po', 'sana', 'kasi', 'talaga', 'namin', 'amin', 'nila', 'niya', 'siya', 'kami',
  'para', 'kung', 'kapag', 'dahil', 'wala', 'meron', 'may', 'nang', 'pag', 'rin',
  'din', 'and', 'the', 'this', 'that', 'with', 'from', 'have', 'been', 'will',
  'were', 'your', 'very', 'into', 'pero', 'sa', 'ng', 'na', 'at', 'ako', 'ko',
  'mo', 'ni', 'si', 'ay', 'yan', 'pa', 'lagi', 'gabi', 'umaga', 'kanina', 'nasa',
  'kayo', 'kami', 'sila', 'ito', 'iyon', 'diyan', 'dito', 'daw', 'nito', 'mismo',
  'agad', 'sobra', 'super', 'naman', 'kasi', 'dapat', 'pwede', 'baka', 'nangyari',
  'lang', 'area', 'city', 'urdaneta',
]);

const TOPIC_PATTERNS = [
  { key: 'aso', keywords: ['aso', 'asong gala', 'stray dog', 'kagat', 'nangangagat', 'asong nakawala', 'aso sa daan'] },
  { key: 'puno', keywords: ['punong natumba', 'natumbang puno', 'fallen tree', 'puno sa daan', 'halos matumbang puno', 'puno'] },
  { key: 'lubak', keywords: ['lubak', 'pothole', 'sirang kalsada', 'road damage', 'bitak sa kalsada'] },
  { key: 'kanal', keywords: ['baradong kanal', 'kanal', 'drainage', 'imburnal', 'estero', 'drain'] },
  { key: 'baha', keywords: ['baha', 'bahain', 'flood', 'flooding', 'lubog', 'waterlogging'] },
  { key: 'basura', keywords: ['basura', 'garbage', 'waste', 'tambak na basura', 'hakot', 'collection'] },
  { key: 'poste', keywords: ['poste', 'kable', 'live wire', 'nakalaylay na wire', 'electric post'] },
  { key: 'traffic', keywords: ['traffic', 'illegal parking', 'nakaharang', 'tricycle', 'aksidente', 'accident'] },
  { key: 'ilaw', keywords: ['street light', 'ilaw', 'madilim', 'street lighting', 'walang ilaw'] },
  { key: 'sunog', keywords: ['sunog', 'wildfire', 'usok', 'fire'] },
];

let cachedTopics = null;

function safeJsonParse(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeCaption(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeCaption(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function slugifyTopic(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractLocationLabel(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'citywide';
  const match = text.match(/^(barangay\s+[^()]+)/i);
  if (match) return match[1].trim().toLowerCase();
  return text.replace(/\([^)]*\)/g, '').trim().toLowerCase() || 'citywide';
}

function topKeywordsFromRows(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const token of tokenize(row.caption)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([token]) => token);
}

function chooseSearchableTopicLabel({ title = '', keywords = [], rows = [] } = {}) {
  const haystack = normalizeCaption([
    title,
    ...keywords,
    ...rows.map((row) => `${row.caption} ${row.service} ${row.locationLabel}`),
  ].join(' '));

  for (const pattern of TOPIC_PATTERNS) {
    if (pattern.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return pattern.key;
    }
  }

  const rowKeywords = topKeywordsFromRows(rows);
  if (rowKeywords.length > 0) return rowKeywords[0];

  const titleTokens = tokenize(title);
  if (titleTokens.length > 0) return titleTokens[0];

  const keywordTokens = keywords
    .flatMap((keyword) => tokenize(keyword))
    .filter(Boolean);
  if (keywordTokens.length > 0) return keywordTokens[0];

  return 'concern';
}

function mostCommonValue(values) {
  const counts = new Map();
  for (const value of values) {
    const key = String(value ?? '').trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let best = '';
  let bestCount = -1;
  for (const [value, count] of counts.entries()) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function normalizeTopicTitle(title, rows) {
  return chooseSearchableTopicLabel({ title, rows });
}

function computePatternScore(row, pattern) {
  const text = normalizeCaption(`${row.caption} ${row.service} ${row.locationLabel}`);
  let score = 0;
  for (const keyword of pattern.keywords) {
    if (text.includes(keyword.toLowerCase())) score += 2;
  }
  return score;
}

function buildFallbackClusters(rows) {
  const grouped = new Map();

  for (const row of rows) {
    let bestPattern = null;
    let bestScore = 0;

    for (const pattern of TOPIC_PATTERNS) {
      const score = computePatternScore(row, pattern);
      if (score > bestScore) {
        bestScore = score;
        bestPattern = pattern;
      }
    }

    const fallbackKey = topKeywordsFromRows([row])[0];
    const key = bestPattern?.key ?? (fallbackKey || 'concern');
    if (!grouped.has(key)) {
      grouped.set(key, { topic: key, rows: [], feedbackIds: [], keywords: [] });
    }

    const cluster = grouped.get(key);
    cluster.rows.push(row);
    cluster.feedbackIds.push(row.id);
  }

  return [...grouped.values()].map((cluster) => ({
    id: `topic:${slugifyTopic(cluster.topic)}`,
    topic: normalizeTopicTitle(cluster.topic, cluster.rows),
    feedback_ids: cluster.feedbackIds,
    keywords: uniqueStrings(topKeywordsFromRows(cluster.rows)).slice(0, 6),
    rows: cluster.rows,
  }));
}

async function buildAiClusters(rows) {
  const result = await createStructuredResponse({
    name: 'raw_topic_feedboxes',
    schema: TOPIC_CLUSTER_SCHEMA,
    instructions: [
      'You cluster civic feedback captions from Urdaneta City into practical raw topic groups.',
      'Handle english, filipino, and taglish naturally.',
      'Different sentence structures that describe the same issue must go into one cluster.',
      'Use short searchable topic labels that are likely to literally appear in captions.',
      'All topic titles must be lowercase only.',
      'Prefer exactly 1 word, or 2 words only if 1 word would be vague.',
      'Good examples: "traffic", "aso", "baha", "basura", "lubak", "kanal", "poste", "ilaw", "sunog".',
      'Avoid long phrases, avoid title case, avoid government language, avoid punctuation, avoid overly broad labels like "infrastructure concern".',
      'Assign every feedback item to exactly one cluster.',
      'Return all clusters, including small ones.',
    ].join(' '),
    input: JSON.stringify({
      feedback: rows.map((row) => ({
        id: row.id,
        caption: row.caption,
        service: row.service,
        location: row.locationLabel,
        type: row.type,
      })),
    }),
  });

  if (result.error || !Array.isArray(result.data?.clusters)) return null;

  const seen = new Set();
  const clusters = [];

  for (const cluster of result.data.clusters) {
    const feedbackIds = uniqueStrings(cluster.feedbackIds).filter((id) => rows.some((row) => row.id === id));
    if (!cluster.topic || feedbackIds.length === 0) continue;

    for (const id of feedbackIds) {
      if (seen.has(id)) return null;
      seen.add(id);
    }

    const clusterRows = rows.filter((row) => feedbackIds.includes(row.id));
    const topic = chooseSearchableTopicLabel({
      title: cluster.topic,
      keywords: cluster.keywords ?? [],
      rows: clusterRows,
    });

    clusters.push({
      id: `topic:${slugifyTopic(topic)}`,
      topic,
      feedback_ids: feedbackIds,
      keywords: uniqueStrings(cluster.keywords).slice(0, 6),
      rows: clusterRows,
    });
  }

  if (seen.size !== rows.length) return null;
  return clusters;
}

function computeStatusBreakdown(rows) {
  return rows.reduce((acc, row) => {
    if (row.status === 'resolved') acc.resolved += 1;
    else if (row.status === 'in_progress' || row.status === 'under_review' || row.status === null) acc.active += 1;
    else acc.others += 1;
    return acc;
  }, { active: 0, resolved: 0, others: 0 });
}

function normalizeCluster(cluster) {
  const rows = cluster.rows ?? [];
  const dominantService = mostCommonValue(rows.map((row) => row.service)) || null;
  const dominantLocation = mostCommonValue(rows.map((row) => row.locationLabel)) || 'citywide';

  return {
    id: cluster.id,
    topic: cluster.topic,
    slug: slugifyTopic(cluster.topic),
    feedback_count: rows.length,
    raises_count: rows.reduce((sum, row) => sum + Number(row.raises_count ?? 0), 0),
    reacts_count: rows.reduce((sum, row) => sum + Number(row.reacts_count ?? 0), 0),
    discuss_count: rows.reduce((sum, row) => sum + Number(row.discuss_count ?? 0), 0),
    feedback_ids: cluster.feedback_ids,
    status_breakdown: computeStatusBreakdown(rows),
    service: dominantService,
    location: dominantLocation,
    created_at: rows[0]?.created_at ?? null,
    keywords: cluster.keywords ?? [],
  };
}

async function fetchAllFeedbackRows(admin) {
  const { data, error } = await admin
    .from('feedbacks')
    .select('id, caption, service, incident_location, created_at, raises_count, discuss_count, reacts_count, type, status')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) throw error;

  return (data ?? [])
    .filter((row) => row?.id && row?.caption)
    .map((row) => ({
      ...row,
      caption: String(row.caption ?? '').trim(),
      locationLabel: extractLocationLabel(row.incident_location),
    }));
}

function sortTopics(rows) {
  return [...rows].sort((a, b) => {
    const countDelta = Number(b.feedback_count ?? 0) - Number(a.feedback_count ?? 0);
    if (countDelta !== 0) return countDelta;
    return Number(b.raises_count ?? 0) - Number(a.raises_count ?? 0);
  });
}

export async function getTopicFeedboxes({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedTopics && (Date.now() - cachedTopics.generatedAt) < CACHE_TTL_MS) {
    return cachedTopics.data;
  }

  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase service role is not configured.');

  const rows = await fetchAllFeedbackRows(admin);
  if (rows.length === 0) return [];

  const aiClusters = await buildAiClusters(rows);
  const clusters = (aiClusters ?? buildFallbackClusters(rows))
    .map(normalizeCluster)
    .filter((cluster) => cluster.feedback_count >= MIN_VISIBLE_FEEDBACKS);

  const sorted = sortTopics(clusters);
  cachedTopics = {
    generatedAt: Date.now(),
    data: sorted,
  };
  return sorted;
}
