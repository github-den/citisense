import { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Archive, 
  Funnel,
  HandHeart, 
  MapPin,
  SealCheck,
} from '@phosphor-icons/react';
import Card from '../../components/ui/Card.jsx';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import FeedCardSkeleton from '../../components/FeedCard/FeedCardSkeleton.jsx';
import { useFeedboxGroups } from '@core/hooks/useFeedboxGroups.js';
import { mapPosts } from '@core/utils/postMapper.js';
import { summarizeMoodFromPosts, getMoodEmoji, formatMoodLabel } from '@core/utils/mood.js';
import { SERVICE_CATEGORIES, URDANETA_BARANGAYS } from '../../constants/index.js';
import styles from './FeedboxPage.module.css';

const TYPE_OPTIONS = ['Complaint', 'Suggestion', 'Compliment'];
const STATUS_OPTIONS = ['Under Review', 'Verified', 'Dismissed', 'In Progress', 'On Hold', 'Resolved'];
const STATUS_SECTIONS = [
  {
    id: 'verification',
    title: 'Verification Status',
    items: ['Under Review', 'Verified', 'Dismissed'],
  },
  {
    id: 'resolution',
    title: 'Resolution Status',
    items: ['In Progress', 'On Hold', 'Resolved'],
  },
];

const TAB_CONFIG = {
  type: {
    label: 'Feedback Type',
    kicker: 'Feedback Type',
    icon: Funnel,
    queryKey: 'type',
    items: TYPE_OPTIONS,
  },
  status: {
    label: 'Complaint Status',
    kicker: 'Complaint Status',
    icon: SealCheck,
    queryKey: 'status',
    items: STATUS_OPTIONS,
  },
  service: {
    label: 'Service Category',
    kicker: 'Service Category',
    icon: HandHeart,
    queryKey: 'category',
    items: SERVICE_CATEGORIES,
  },
  location: {
    label: 'Incident Location',
    kicker: 'Incident Location',
    icon: MapPin,
    queryKey: 'barangay',
    items: URDANETA_BARANGAYS,
  },
};

const TAB_ORDER = ['service', 'location', 'type', 'status'];

function normalizeTab(searchParams) {
  const requested = searchParams.get('tab');
  return TAB_ORDER.includes(requested) ? requested : 'service';
}

function getTabFilter(searchParams, tab) {
  const queryKey = TAB_CONFIG[tab]?.queryKey;
  const value = queryKey ? searchParams.get(queryKey) : null;
  if (!value) return value;
  if (tab === 'type') return formatTypeLabel(value);
  return value;
}

function formatTypeLabel(value) {
  if (value === 'suggestion') return 'Suggestion';
  if (value === 'compliment') return 'Compliment';
  return 'Complaint';
}

function isVerifiedStatus(value) {
  return value === 'In Progress' || value === 'On Hold' || value === 'Resolved';
}

function getFeedboxItemLabel(item, tab) {
  if (tab === 'type') return formatTypeLabel(item.post.type);
  if (tab === 'status') return item.post.status;
  if (tab === 'service') return item.post.service;
  return item.row?.location_group;
}

function matchesFeedboxFilter(item, tab, filter) {
  if (tab === 'status' && filter === 'Verified') {
    return isVerifiedStatus(item.post.status);
  }

  return getFeedboxItemLabel(item, tab) === filter;
}

function FeedboxPlaceholder() {
  return (
    <div className={styles.skeletonCard}>
      <Archive size={32} weight="fill" />
    </div>
  );
}

function summarizeFacet(values, fallback) {
  const counts = new Map();

  values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });

  if (counts.size === 0) {
    return {
      labels: [],
      remaining: 0,
      text: fallback,
    };
  }

  const sorted = [...counts.entries()].sort((left, right) => {
    const countDelta = right[1] - left[1];
    return countDelta !== 0 ? countDelta : left[0].localeCompare(right[0]);
  });

  const labels = sorted.slice(0, 1).map(([label]) => label);
  const remaining = Math.max(sorted.length - labels.length, 0);

  return {
    labels,
    remaining,
    text: `${labels.length > 0 ? labels[0] : ''}${remaining > 0 ? ` +${remaining}` : ''}`,
  };
}

function buildGroupDetail(matches, tab) {
  if (tab === 'service') {
    const summary = summarizeFacet(
      matches.map((entry) => entry.row?.location_group),
      'No locations yet',
    );
    return {
      icon: MapPin,
      text: summary.text,
    };
  }

  if (tab === 'location') {
    const summary = summarizeFacet(
      matches.map((entry) => entry.post.service),
      'No services yet',
    );
    return {
      icon: HandHeart,
      text: summary.text,
    };
  }

  const summary = summarizeFacet(
    matches.map((entry) => entry.post.service),
    'No services yet',
  );
  return {
    icon: HandHeart,
    text: summary.text,
  };
}

function formatGroupMeta(count, raises) {
  const feedbackLabel = `${count} feedback${count === 1 ? '' : 's'}`;
  const raiseLabel = `${raises} raise${raises === 1 ? '' : 's'}`;
  return `${feedbackLabel}, ${raiseLabel}`;
}

function GroupCard({ title, metaLabel, detailIcon: DetailIcon, detailText, mood, emoji, onClick }) {
  return (
    <Card className={styles.feedboxCard}>
      <button type="button" className={styles.feedboxButton} onClick={onClick}>
        <div className={styles.cardBody}>
          <div className={styles.cardMoodHeader}>
            <span>MOOD: {emoji || '😶'} {mood || 'No mood data yet'}</span>
          </div>
          <h2 className={styles.cardTitle}>
            <span className={styles.cardTitleText}>{title}</span>
          </h2>
          <p className={styles.cardSub}>
            <span className={styles.cardDetailIcon}>
              <DetailIcon size={14} weight="fill" />
            </span>
            <span>{detailText}</span>
          </p>
        </div>
        <div className={styles.cardFooter}>
          <span className={styles.cardMeta}>{metaLabel}</span>
        </div>
      </button>
    </Card>
  );
}

export default function FeedboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { rows, loading, error: groupsError } = useFeedboxGroups();
  
  const urlTab = normalizeTab(searchParams);
  const urlFilter = getTabFilter(searchParams, urlTab);

  const [activeTab, setActiveTab] = useState(urlTab);
  const [activeSubFilter, setActiveSubFilter] = useState(urlFilter);

  useEffect(() => {
    setActiveTab(urlTab);
    setActiveSubFilter(urlFilter);
  }, [urlTab, urlFilter]);

  const feedItems = useMemo(() => mapPosts(rows).map((post, index) => ({
    post,
    row: rows[index],
  })), [rows]);

  const selectGroupFilter = async (tab, filter) => {
    const config = TAB_CONFIG[tab];
    if (!config) return;

    if (filter === 'all') {
      router.push(`/feedbox?tab=${tab}`, { scroll: false });
      return;
    }

    const params = new URLSearchParams();
    params.set('tab', tab);
    params.set(config.queryKey, filter);
    
    router.push(`/feedbox?${params.toString()}`, { scroll: false });
  };

  const groupData = useMemo(() => {
    const config = TAB_CONFIG[activeTab];
    if (!config) return [];

    return config.items.map((item) => {
      const matches = feedItems.filter((entry) => matchesFeedboxFilter(entry, activeTab, item));
      const groupPosts = matches.map((entry) => entry.post);
      const moodSummary = summarizeMoodFromPosts(groupPosts, { allowPrediction: true, minTotal: 1, minShare: 0 });
      
      return {
        label: item,
        count: matches.length,
        totalRaises: matches.reduce((sum, entry) => sum + Number(entry.row?.raises_count ?? 0), 0),
        detail: buildGroupDetail(matches, activeTab),
        moodLabel: moodSummary?.mood ? formatMoodLabel(moodSummary.mood) : null,
        moodEmoji: moodSummary?.mood ? getMoodEmoji(moodSummary.mood) : null,
      };
    }).sort((a, b) => b.count - a.count);
  }, [activeTab, feedItems]);

  const statusSectionData = useMemo(() => {
    if (activeTab !== 'status') return [];

    return STATUS_SECTIONS.map((section) => ({
      ...section,
      groups: section.items
        .map((item) => groupData.find((group) => group.label === item))
        .filter(Boolean),
    }));
  }, [activeTab, groupData]);

  const filteredPosts = useMemo(() => {
    if (!activeSubFilter || activeSubFilter === 'all') return [];

    return feedItems
      .filter((entry) => matchesFeedboxFilter(entry, activeTab, activeSubFilter))
      .map((entry) => entry.post);
  }, [activeSubFilter, activeTab, feedItems]);

  const isLoading = loading;
  const activeError = groupsError;

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
              Browse civic concerns grouped by type, status, service category, or incident location.
            </p>
          </div>

          <div className={styles.asideSection}>
            <nav className={styles.tabNav}>
              {TAB_ORDER.map((tabKey) => {
                const tab = TAB_CONFIG[tabKey];
                const Icon = tab.icon;
                const isActive = activeTab === tabKey;

                return (
                  <button
                    key={tabKey}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    onClick={() => {
                      setActiveTab(tabKey);
                      setActiveSubFilter(null);
                      router.push(`/feedbox?tab=${tabKey}`, { scroll: false });
                    }}
                  >
                    <div className={styles.navItemContent}>
                      <Icon size={20} weight={isActive ? 'duotone' : 'regular'} />
                      <span>{tab.label}</span>
                    </div>
                  </button>
                );
              })}
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
              Unable to load feedbox groups right now.
            </div>
          </div>
        ) : (
          !activeSubFilter ? (
            groupData.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyText}>
                  No feedbox groups available right now.
                </div>
              </div>
            ) : (
              activeTab === 'status' ? (
                <div className={styles.sectionStack}>
                  {statusSectionData.map((section) => (
                    <section key={section.id} className={styles.groupSection}>
                      <div className={styles.groupSectionHeader}>
                        <h2 className={styles.groupSectionTitle}>{section.title}</h2>
                      </div>
                      <div className={styles.grid}>
                        {section.groups.map((group) => (
                          <GroupCard 
                            key={group.label} 
                            title={group.label} 
                            metaLabel={formatGroupMeta(group.count, group.totalRaises)}
                            detailIcon={group.detail.icon}
                            detailText={group.detail.text}
                            mood={group.moodLabel}
                            emoji={group.moodEmoji}
                            onClick={() => selectGroupFilter(activeTab, group.label)}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className={styles.grid}>
                  {groupData.map((group) => (
                    <GroupCard 
                      key={group.label} 
                      title={group.label} 
                      metaLabel={formatGroupMeta(group.count, group.totalRaises)}
                      detailIcon={group.detail.icon}
                      detailText={group.detail.text}
                      mood={group.moodLabel}
                      emoji={group.moodEmoji}
                      onClick={() => selectGroupFilter(activeTab, group.label)}
                    />
                  ))}
                  {Array.from({
                    length: (groupData.length % 3 === 0) ? 0 : 3 - (groupData.length % 3),
                  }).map((_, i) => (
                    <FeedboxPlaceholder key={`placeholder-${i}`} />
                  ))}
                </div>
              )
            )
          ) : (
            <div className={styles.feedList}>
              <div className={styles.resultsHeader}>
                <div>
                  <p className={styles.resultsKicker}>
                    {TAB_CONFIG[activeTab]?.kicker ?? 'Feedbox'}
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
