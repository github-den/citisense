import { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Archive, 
  Broadcast,
  HandHeart, 
  MapPin,
} from '@phosphor-icons/react';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import Card from '../../components/ui/Card.jsx';
import Popover from '../../components/ui/Popover.jsx';
import Button from '../../components/ui/Button.jsx';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import FeedCardSkeleton from '../../components/FeedCard/FeedCardSkeleton.jsx';
import { useFeedboxGroups } from '@core/hooks/useFeedboxGroups.js';
import { useTopicFeedboxes } from '@core/hooks/useTopicFeedboxes.js';
import { mapPosts } from '@core/utils/postMapper.js';
import { SERVICE_CATEGORIES, URDANETA_BARANGAYS } from '../../constants/index.js';
import styles from './FeedboxPage.module.css';
import shellStyles from '../CitizenDataPage.module.css';

const STATUS_COLORS = {
  active: '#16a34a',
  resolved: '#2563eb',
  others: '#d97706',
};
const TOPIC_BATCH_SIZE = 9;

const TOPIC_MIN_FEEDBACKS = 3;
const TOPIC_STOP_WORDS = new Set([
  'ang', 'mga', 'yung', 'itong', 'iyon', 'iyan', 'dito', 'doon', 'lang', 'naman',
  'po', 'sana', 'kasi', 'talaga', 'namin', 'amin', 'nila', 'niya', 'siya', 'kami',
  'para', 'kung', 'kapag', 'dahil', 'wala', 'meron', 'may', 'nang', 'pag', 'rin',
  'din', 'and', 'the', 'this', 'that', 'with', 'from', 'have', 'been', 'will',
  'were', 'your', 'very', 'into', 'pero', 'sa', 'ng', 'na', 'at', 'ako', 'ko',
  'mo', 'ni', 'si', 'ay', 'yan', 'pa', 'lagi', 'gabi', 'umaga', 'kanina', 'nasa',
  'kayo', 'sila', 'ito', 'diyan', 'daw', 'nito', 'mismo', 'agad', 'sobra', 'super',
  'dapat', 'pwede', 'baka', 'nangyari', 'area', 'city', 'urdaneta',
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

function deriveStatusBreakdown(box) {
  if (box.status_breakdown) return box.status_breakdown;
  const total = Number(box.feedback_count ?? 0);
  return {
    active: Math.max(1, Math.round(total * 0.42)),
    resolved: Math.max(1, Math.round(total * 0.34)),
    others: Math.max(0, total - Math.round(total * 0.42) - Math.round(total * 0.34)),
  };
}

function normalizeTopicText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeTopicText(value) {
  return normalizeTopicText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !TOPIC_STOP_WORDS.has(token));
}

function slugifyTopic(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function topTopicKeywords(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const token of tokenizeTopicText(row.caption)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([token]) => token);
}

function chooseSearchableTopicLabel({ title = '', keywords = [], rows = [] } = {}) {
  const haystack = normalizeTopicText([
    title,
    ...keywords,
    ...rows.map((row) => `${row.caption} ${row.service} ${row.location_group}`),
  ].join(' '));

  for (const pattern of TOPIC_PATTERNS) {
    if (pattern.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return pattern.key;
    }
  }

  const rowKeywords = topTopicKeywords(rows);
  if (rowKeywords.length > 0) return rowKeywords[0];

  const titleTokens = tokenizeTopicText(title);
  if (titleTokens.length > 0) return titleTokens[0];

  const keywordTokens = keywords
    .flatMap((keyword) => tokenizeTopicText(keyword))
    .filter(Boolean);
  if (keywordTokens.length > 0) return keywordTokens[0];

  return 'concern';
}

function computeStatusBreakdown(rows) {
  return rows.reduce((acc, row) => {
    if (row.status === 'resolved') acc.resolved += 1;
    else if (row.status === 'in_progress' || row.status === 'under_review' || row.status === null) acc.active += 1;
    else acc.others += 1;
    return acc;
  }, { active: 0, resolved: 0, others: 0 });
}

function getTopicMatchScore(row, pattern) {
  const text = normalizeTopicText(`${row.caption} ${row.service} ${row.location_group}`);
  let score = 0;
  for (const keyword of pattern.keywords) {
    if (text.includes(keyword.toLowerCase())) score += 2;
  }
  return score;
}

function buildLocalTopicFeedboxes(rows) {
  const grouped = new Map();

  for (const row of rows) {
    let bestPattern = null;
    let bestScore = 0;

    for (const pattern of TOPIC_PATTERNS) {
      const score = getTopicMatchScore(row, pattern);
      if (score > bestScore) {
        bestScore = score;
        bestPattern = pattern;
      }
    }

    const fallbackKey = topTopicKeywords([row])[0];
    const topic = bestPattern?.key ?? fallbackKey ?? 'concern';

    if (!grouped.has(topic)) {
      grouped.set(topic, []);
    }
    grouped.get(topic).push(row);
  }

  return [...grouped.entries()]
    .map(([topic, topicRows]) => ({
      id: `topic:${slugifyTopic(chooseSearchableTopicLabel({ title: topic, rows: topicRows }))}`,
      topic: chooseSearchableTopicLabel({ title: topic, rows: topicRows }),
      slug: slugifyTopic(chooseSearchableTopicLabel({ title: topic, rows: topicRows })),
      feedback_count: topicRows.length,
      raises_count: topicRows.reduce((sum, row) => sum + Number(row.raises_count ?? 0), 0),
      reacts_count: topicRows.reduce((sum, row) => sum + Number(row.reacts_count ?? 0), 0),
      discuss_count: topicRows.reduce((sum, row) => sum + Number(row.discuss_count ?? 0), 0),
      feedback_ids: topicRows.map((row) => row.id),
      status_breakdown: computeStatusBreakdown(topicRows),
      keywords: topTopicKeywords(topicRows),
    }))
    .filter((box) => box.feedback_count >= TOPIC_MIN_FEEDBACKS)
    .sort((a, b) => {
      const countDelta = Number(b.feedback_count ?? 0) - Number(a.feedback_count ?? 0);
      if (countDelta !== 0) return countDelta;
      return Number(b.raises_count ?? 0) - Number(a.raises_count ?? 0);
    });
}

function mergeTopicCards(cards) {
  const grouped = new Map();

  for (const card of cards ?? []) {
    const topic = String(card?.topic ?? '').trim().toLowerCase();
    if (!topic) continue;

    if (!grouped.has(topic)) {
      grouped.set(topic, {
        ...card,
        id: `topic:${slugifyTopic(topic)}`,
        slug: slugifyTopic(topic),
        topic,
        feedback_ids: [...new Set(card.feedback_ids ?? [])],
        keywords: [...new Set(card.keywords ?? [])],
      });
      continue;
    }

    const current = grouped.get(topic);
    current.feedback_count = Number(current.feedback_count ?? 0) + Number(card.feedback_count ?? 0);
    current.raises_count = Number(current.raises_count ?? 0) + Number(card.raises_count ?? 0);
    current.reacts_count = Number(current.reacts_count ?? 0) + Number(card.reacts_count ?? 0);
    current.discuss_count = Number(current.discuss_count ?? 0) + Number(card.discuss_count ?? 0);
    current.feedback_ids = [...new Set([...(current.feedback_ids ?? []), ...(card.feedback_ids ?? [])])];
    current.keywords = [...new Set([...(current.keywords ?? []), ...(card.keywords ?? [])])];
    current.status_breakdown = {
      active: Number(current.status_breakdown?.active ?? 0) + Number(card.status_breakdown?.active ?? 0),
      resolved: Number(current.status_breakdown?.resolved ?? 0) + Number(card.status_breakdown?.resolved ?? 0),
      others: Number(current.status_breakdown?.others ?? 0) + Number(card.status_breakdown?.others ?? 0),
    };
  }

  return [...grouped.values()].sort((a, b) => {
    const countDelta = Number(b.feedback_count ?? 0) - Number(a.feedback_count ?? 0);
    if (countDelta !== 0) return countDelta;
    return Number(b.raises_count ?? 0) - Number(a.raises_count ?? 0);
  });
}

function BreakdownPopover({ box }) {
  const breakdown = deriveStatusBreakdown(box);
  const data = [
    { name: 'Active', value: breakdown.active, color: STATUS_COLORS.active },
    { name: 'Resolved', value: breakdown.resolved, color: STATUS_COLORS.resolved },
    { name: 'Others', value: breakdown.others, color: STATUS_COLORS.others },
  ];
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={styles.metricPopover}>
      <div className={styles.metricPopoverTitle}>Feedback status split</div>
      <div className={styles.donutWrap}>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={3}>
              {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <RechartsTooltip
              formatter={(value, name) => [value, name]}
              contentStyle={{ borderRadius: 12, border: '1px solid #d8e3f0', fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.donutCenter}>
          <strong>{total}</strong>
          <span>Total</span>
        </div>
      </div>
      <div className={styles.metricLegend}>
        {data.map((item) => (
          <div key={item.name} className={styles.legendRow}>
            <span className={styles.legendSwatch} style={{ background: item.color }} />
            <span>{item.name}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedboxPlaceholder() {
  return (
    <div className={styles.skeletonCard}>
      <Archive size={32} weight="fill" />
    </div>
  );
}

function GroupCard({ title, count, subLabel, icon: Icon, onClick }) {
  return (
    <Card className={styles.feedboxCard}>
      <button type="button" className={styles.feedboxButton} onClick={onClick}>
        <div className={styles.cardTop}>
          <div className={styles.cardLeft}>
            <span className={styles.boxIcon}>
              <Icon size={18} weight="duotone" />
            </span>
            <span className={styles.metricCount}>{count}</span>
          </div>
        </div>
        <div className={styles.cardBody}>
          <h2 className={styles.cardTitle}>
            <span className={styles.cardTitleText}>{title}</span>
          </h2>
          <p className={styles.cardSub}>{subLabel}</p>
        </div>
      </button>
    </Card>
  );
}

export default function FeedboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { rows, loading, error: groupsError } = useFeedboxGroups();
  const { topics: topicFeedboxes, loading: loadingTopics, error: topicsError } = useTopicFeedboxes({ autoRefreshMs: 30 * 60 * 1000 });
  
  const urlTab = searchParams.get('tab') === 'service'
    ? 'service'
    : (searchParams.get('tab') === 'location' ? 'location' : 'topic');
  const urlFilter = urlTab === 'service'
    ? searchParams.get('category')
    : (urlTab === 'location' ? searchParams.get('barangay') : null);

  const [activeTab, setActiveTab] = useState(urlTab);
  const [activeSubFilter, setActiveSubFilter] = useState(urlFilter);
  const [topicVisibleCount, setTopicVisibleCount] = useState(TOPIC_BATCH_SIZE);

  useEffect(() => {
    setActiveTab(urlTab);
    setActiveSubFilter(urlFilter);
  }, [urlTab, urlFilter]);

  useEffect(() => {
    if (activeTab === 'topic') {
      setTopicVisibleCount(TOPIC_BATCH_SIZE);
    }
  }, [activeTab]);

  const services = SERVICE_CATEGORIES;
  const locations = URDANETA_BARANGAYS;

  const selectGroupFilter = async (tab, filter, payload = null) => {
    if (tab === 'topic') {
      const topicTitle = String(filter ?? '').trim();
      if (!topicTitle) return;
      window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));

      try {
        const res = await fetch('/api/posts/by-topic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topicTitle,
            keywords: Array.isArray(payload?.keywords) ? payload.keywords : [],
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? 'Unable to load topic posts.');

        sessionStorage.setItem('citisense_topic_posts', JSON.stringify(json.posts ?? []));
        sessionStorage.setItem('citisense_topic_query', topicTitle);
        router.push(`/search?q=${encodeURIComponent(topicTitle)}&topic=1`);
      } catch {
        const params = new URLSearchParams();
        params.set('q', topicTitle);
        router.push(`/search?${params.toString()}`);
      }
      return;
    }

    if (filter === 'all') {
      router.push(`/feedbox?tab=${tab}`, { scroll: false });
      return;
    }

    const params = new URLSearchParams();
    params.set('tab', tab);
    if (tab === 'service') params.set('category', filter);
    if (tab === 'location') params.set('barangay', filter);
    
    router.push(`/feedbox?${params.toString()}`, { scroll: false });
  };

  const groupData = useMemo(() => {
    if (activeTab === 'topic') return [];
    const items = activeTab === 'service' ? services : locations;
    return items.map(item => {
      const matches = rows.filter((row) => {
        if (activeTab === 'service') return row.service === item;
        return row.location_group === item;
      });
      
      return {
        label: item,
        count: matches.length,
        totalRaises: matches.reduce((sum, row) => sum + Number(row.raises_count ?? 0), 0),
        icon: activeTab === 'service' ? HandHeart : MapPin
      };
    }).sort((a, b) => b.count - a.count);
  }, [activeTab, locations, rows, services]);

  const localTopicCards = useMemo(() => buildLocalTopicFeedboxes(rows), [rows]);
  const topicCards = useMemo(() => {
    if (Array.isArray(topicFeedboxes) && topicFeedboxes.length > 0) {
      const seen = new Set();
      return topicFeedboxes
        .map((row) => ({
        id: row.id,
        topic: row.title,
        keywords: row.keywords ?? [],
        rank: row.rank ?? null,
        feedback_count: row.post_count ?? 0,
        raises_count: row.raises_count ?? 0,
        }))
        .filter((row) => {
          const key = String(row.topic ?? '').trim().toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }
    return mergeTopicCards(localTopicCards);
  }, [localTopicCards, topicFeedboxes]);

  const visibleTopicCards = useMemo(
    () => topicCards.slice(0, topicVisibleCount),
    [topicCards, topicVisibleCount],
  );
  const hasMoreTopics = visibleTopicCards.length < topicCards.length;

  const filteredPosts = useMemo(() => {
    if (!activeSubFilter || activeSubFilter === 'all') return [];

    const filteredRows = rows.filter((row) => {
      if (activeTab === 'service') return row.service === activeSubFilter;
      return row.location_group === activeSubFilter;
    });
    return mapPosts(filteredRows);
  }, [activeSubFilter, activeTab, rows]);

  const isLoading = activeTab === 'topic'
    ? ((loading || loadingTopics) && topicCards.length === 0)
    : loading;
  const activeError = activeTab === 'topic'
    ? (!loading && !loadingTopics && topicCards.length === 0 && topicsError ? topicsError : null)
    : groupsError;

  return (
    <div className={styles.feedboxContainer}>
      {/* LEFT ASIDE */}
      <aside className={styles.leftAside}>
        <div className={styles.leftAsideContent}>
          <div className={styles.asideSection}>
            <div className={styles.asideHeader}>
              <div className={styles.iconWrap}>
                <Archive size={20} weight="fill" />
              </div>
              <h1>Feedbox</h1>
            </div>
            <p className={styles.asideSubtitle}>
              Browse civic concerns grouped by topic, service category, or incident location.
            </p>
          </div>

          <div className={styles.asideSection}>
            <nav className={styles.tabNav}>
              <button
                className={`${styles.navItem} ${activeTab === 'topic' ? styles.navItemActive : ''}`}
                onClick={() => { setActiveTab('topic'); setActiveSubFilter(null); router.push('/feedbox?tab=topic', { scroll: false }); }}
              >
                <div className={styles.navItemContent}>
                  <Broadcast size={20} weight={activeTab === 'topic' ? 'duotone' : 'regular'} />
                  <span>Topic</span>
                </div>
              </button>

              <button
                className={`${styles.navItem} ${activeTab === 'service' ? styles.navItemActive : ''}`}
                onClick={() => { setActiveTab('service'); setActiveSubFilter(null); router.push('/feedbox?tab=service', { scroll: false }); }}
              >
                <div className={styles.navItemContent}>
                  <HandHeart size={20} weight={activeTab === 'service' ? "duotone" : "regular"} />
                  <span>Service Category</span>
                </div>
              </button>

              <button
                className={`${styles.navItem} ${activeTab === 'location' ? styles.navItemActive : ''}`}
                onClick={() => { setActiveTab('location'); setActiveSubFilter(null); router.push('/feedbox?tab=location', { scroll: false }); }}
              >
                <div className={styles.navItemContent}>
                  <MapPin size={20} weight={activeTab === 'location' ? "duotone" : "regular"} />
                  <span>Incident Location</span>
                </div>
              </button>
            </nav>
          </div>
        </div>
      </aside>

      {/* RIGHT CONTENT */}
      <main className={styles.mainContent}>

        {isLoading ? (
          activeSubFilter ? (
            <div className={styles.feedList}>
              <FeedCardSkeleton />
              <FeedCardSkeleton />
            </div>
          ) : (
            <div className={styles.grid}>
              {Array.from({ length: 12 }).map((_, i) => (
                <FeedboxPlaceholder key={i} />
              ))}
            </div>
          )
        ) : activeError ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyText}>
              {activeTab === 'topic'
                ? 'Unable to load topic feedboxes right now.'
                : 'Unable to load feedbox groups right now.'}
            </div>
          </div>
        ) : (
          (activeTab === 'topic' || !activeSubFilter) ? (
            (activeTab === 'topic' ? topicCards.length : groupData.length) === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyText}>
                  {activeTab === 'topic'
                    ? 'No topic feedboxes available right now.'
                    : 'No feedbox groups available right now.'}
                </div>
              </div>
            ) : (
              <div className={styles.grid}>
                {activeTab === 'topic'
                  ? visibleTopicCards.map((box) => (
                    <GroupCard
                      key={box.id}
                      title={box.topic}
                      count={box.feedback_count ?? 0}
                      subLabel={`${box.raises_count ?? 0} raises`}
                      icon={Broadcast}
                      onClick={() => selectGroupFilter('topic', box.topic, { keywords: box.keywords })}
                    />
                  ))
                  : groupData.map((group) => (
                    <GroupCard 
                      key={group.label} 
                      title={group.label} 
                      count={group.count}
                      subLabel={`${group.totalRaises} raises`}
                      icon={group.icon}
                      onClick={() => selectGroupFilter(activeTab, group.label)}
                    />
                  ))}
                {activeTab === 'topic' ? (
                  hasMoreTopics ? (
                    <div className={styles.topicGridCenter}>
                      <Button
                        variant="outline"
                        size="md"
                        className={styles.topicActionTrackButton}
                        onClick={() => setTopicVisibleCount((prev) => prev + TOPIC_BATCH_SIZE)}
                      >
                        Show more
                      </Button>
                    </div>
                  ) : (
                    <div className={styles.topicGridCenter}>
                      <div className={styles.topicDoneBody}>
                        <div className={`${shellStyles.zeroState} ${styles.topicDoneState}`}>
                          <p className={shellStyles.zeroTitle}>You&apos;re all caught up.</p>
                          <span className={shellStyles.zeroText}>New topic feedboxes will appear here after the next trend refresh.</span>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  Array.from({
                    length: (groupData.length % 3 === 0) ? 0 : 3 - (groupData.length % 3),
                  }).map((_, i) => (
                    <FeedboxPlaceholder key={`placeholder-${i}`} />
                  ))
                )}
              </div>
            )
          ) : (
            <div className={styles.feedList}>
              <div className={styles.resultsHeader}>
                <div>
                  <p className={styles.resultsKicker}>
                    {activeTab === 'service' ? 'Service Category' : 'Incident Location'}
                  </p>
                  <h2 className={styles.resultsTitle}>
                    {activeSubFilter}
                  </h2>
                  <span className={styles.resultsMeta}>{filteredPosts.length} feedback entries</span>
                </div>
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={() => selectGroupFilter(activeTab, 'all')}
                >
                  Back to all
                </button>
              </div>

              {filteredPosts.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyText}>No feedback found for the current selection.</div>
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <FeedCard key={post.id} post={post} />
                ))
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
}
