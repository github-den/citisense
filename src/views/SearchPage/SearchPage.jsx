import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import {
  MagnifyingGlass,
  ChatCenteredText,
  Users,
  UserCircle,
  ShieldCheck,
  CaretDown,
  CaretRight,
  Funnel,
  HandHeart,
  MegaphoneSimple,
  SealCheck,
} from '@phosphor-icons/react';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import FeedCardSkeleton from '../../components/FeedCard/FeedCardSkeleton.jsx';
import { useSearch } from '@core/hooks/useSearch.js';
import { useAuth } from '@core/context/AuthContext.jsx';
import { supabase } from '@core/lib/supabase.js';
import { SERVICE_CATEGORIES } from '../../constants/index.js';
import SearchFilterSelect from '../../components/ui/SearchFilterSelect.jsx';
import DateRangePicker from './DateRangePicker.jsx';
import styles from './SearchPage.module.css';

const FROM_OPTIONS = [
  { value: 'anyone', label: 'Anyone' },
  { value: 'following', label: 'People you follow' },
];
const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'compliment', label: 'Compliment' },
];
const VERIFICATION_OPTIONS = [
  { value: 'all', label: 'All verifications' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'verified', label: 'Verified' },
  { value: 'dismissed', label: 'Dismissed' },
];
const RESOLUTION_OPTIONS = [
  { value: 'all', label: 'All resolutions' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'resolved', label: 'Resolved' },
];
const SERVICE_CATEGORY_OPTIONS = SERVICE_CATEGORIES.map(c => ({ value: c, label: c }));

// Format a Date as YYYY-MM-DD using local time (avoids UTC-shift off-by-one)
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildSearchUrl(query, filters, tab) {
  const p = new URLSearchParams();
  if (query) p.set('q', query);
  if (tab && tab !== 'feedback') p.set('tab', tab);
  if (filters?.type && filters.type !== 'all') p.set('type', filters.type);
  if (filters?.from && filters.from !== 'anyone') p.set('from', filters.from);
  if (filters?.category && filters.category !== 'all') p.set('category', filters.category);
  if (filters?.verification && filters.verification !== 'all') p.set('verification', filters.verification);
  if (filters?.resolution && filters.resolution !== 'all') p.set('resolution', filters.resolution);
  if (filters?.dateRange?.start) p.set('date_start', toLocalDateStr(filters.dateRange.start));
  if (filters?.dateRange?.end) p.set('date_end', toLocalDateStr(filters.dateRange.end));
  const qs = p.toString();
  return `/search${qs ? `?${qs}` : ''}`;
}

/* ─── FEED CONTENT ─────────────────────────────────────────────────────────── */
export function SearchResultsFeed({ committed, activeTab, filters, results, loading }) {
  const router = useRouter();
  const { session } = useAuth();
  const currentUserId = session?.user?.id ?? null;

  // Fetch followed user IDs for "People you follow" filter
  const [followedIds, setFollowedIds] = useState(null); // null = not yet fetched
  useEffect(() => {
    if (!currentUserId || !supabase) { setFollowedIds(null); return; }
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId)
      .then(({ data }) => setFollowedIds(new Set((data ?? []).map(r => r.following_id))));
  }, [currentUserId]);

  const [citizens, setCitizens] = useState([]);
  const [busyCitizens, setBusyCitizens] = useState(false);

  const filteredResults = useMemo(() => {
    let list = results ?? [];

    // ── type
    if (filters.type !== 'all') list = list.filter(p => p.raw?.type === filters.type);

    // ── verification  (maps to raw.status on complaints)
    // DB status enum: under_review | in_progress | on_hold | resolved | dismissed
    // UI verification options: under_review | verified | dismissed
    // "verified" means the complaint has been actioned (status is in_progress / on_hold / resolved)
    if (filters.verification !== 'all') {
      list = list.filter(p => {
        const st = p.raw?.status ?? null;
        if (filters.verification === 'under_review') return st === 'under_review' || st === null;
        if (filters.verification === 'dismissed')    return st === 'dismissed';
        if (filters.verification === 'verified')     return st === 'in_progress' || st === 'on_hold' || st === 'resolved';
        return true;
      });
    }

    // ── resolution  (only meaningful when verification === 'verified')
    if (filters.verification === 'verified' && filters.resolution !== 'all') {
      list = list.filter(p => p.raw?.status === filters.resolution);
    }

    // ── category
    if (filters.category !== 'all') list = list.filter(p => p.raw?.service === filters.category);

    // ── date range
    const { start, end } = filters.dateRange ?? {};
    if (start) {
      const s = new Date(start).setHours(0, 0, 0, 0);
      list = list.filter(p => new Date(p.raw?.created_at ?? p.created_at).getTime() >= s);
    }
    if (end) {
      const e = new Date(end).setHours(23, 59, 59, 999);
      list = list.filter(p => new Date(p.raw?.created_at ?? p.created_at).getTime() <= e);
    }

    // ── from ("People you follow")  — only applied when follows have been fetched
    if (filters.from === 'following' && followedIds !== null) {
      list = list.filter(p => followedIds.has(p.userId ?? p.raw?.user_id));
    }

    return list;
  }, [results, filters, followedIds]);

  useEffect(() => {
    if (activeTab === 'citizen' && committed) {
      setBusyCitizens(true);
      supabase
        .from('profiles')
        .select('id, username, avatar, following_count, followers_count, raises_count, resolved_count')
        .ilike('username', `%${committed}%`)
        .limit(20)
        .then(({ data }) => { setCitizens(data ?? []); setBusyCitizens(false); });
    }
  }, [activeTab, committed]);

  function goToProfile(username) {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    router.push(`/profile/${username}`);
  }

  return (
    <>
      {/* ── FEEDBACK TAB ── */}
      {loading && activeTab === 'feedback' && (
        <><FeedCardSkeleton /><FeedCardSkeleton /><FeedCardSkeleton /></>
      )}
      {!loading && activeTab === 'feedback' && filteredResults.length === 0 && committed && (
        <div className={styles.empty}>
          <MagnifyingGlass size={48} weight="duotone" color="var(--text-4)" />
          <h3>No feedbacks found for "{committed}"</h3>
          <p>Try broadening your filters or using different keywords.</p>
        </div>
      )}
      {!committed && (
        <div className={styles.empty}>
          <MagnifyingGlass size={48} weight="duotone" color="var(--text-4)" />
          <h3>Search CitiSense</h3>
          <p>Type a keyword above to find feedbacks or citizens.</p>
        </div>
      )}
      {activeTab === 'feedback' && !loading && filteredResults.map(post => (
        <FeedCard key={post.id} post={post} />
      ))}

      {/* ── CITIZEN TAB ── */}
      {activeTab === 'citizen' && !busyCitizens && citizens.length === 0 && committed && (
        <div className={styles.empty}>
          <MagnifyingGlass size={48} weight="duotone" color="var(--text-4)" />
          <h3>No citizens found for "{committed}"</h3>
          <p>Try broadening your filters or using different keywords.</p>
        </div>
      )}
      {activeTab === 'citizen' && (
        <div className={styles.citizenList}>
          {busyCitizens && [0, 1, 2].map(i => <div key={i} className={styles.citizenCardSkel} />)}
          {!busyCitizens && citizens.map(c => (
            <div key={c.id} className={styles.citizenCard}>
              {/* Avatar */}
              <div className={styles.citizenAvatarWrap}>
                {c.avatar?.startsWith('/avatars/') ? (
                  <img src={c.avatar} alt={c.username} className={styles.citizenAvatarImg} />
                ) : (
                  <div className={styles.citizenAvatarInit}>{(c.username || 'C')[0].toUpperCase()}</div>
                )}
              </div>

              {/* Username */}
              <button
                type="button"
                className={styles.citizenUsername}
                onClick={() => goToProfile(c.username)}
              >
                {c.username}
              </button>

              {/* Vertical divider */}
              <div className={styles.citizenVDivider} />

              {/* Stats */}
              <div className={styles.citizenStats}>
                {[
                  { num: c.following_count ?? 0, label: 'Following' },
                  { num: c.followers_count ?? 0, label: 'Followers' },
                  { num: c.raises_count    ?? 0, label: 'Raises' },
                  { num: c.resolved_count  ?? 0, label: 'Resolved' },
                ].map(({ num, label }) => (
                  <div key={label} className={styles.citizenStat}>
                    <strong className={styles.citizenStatNum}>{num}</strong>
                    <span className={styles.citizenStatLabel}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className={styles.citizenActions}>
                <button type="button" className={styles.citizenFollowBtn}>Follow</button>
                <button type="button" className={styles.citizenBlockBtn}>Block</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ─── ASIDE FILTERS ─────────────────────────────────────────────────────────── */
export function SearchAsideFilters({ activeTab, filters }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q') ?? '';

  // Local date range state so picker stays responsive while user is picking
  const [localDateRange, setLocalDateRange] = useState(filters.dateRange ?? { start: null, end: null });

  // Sync local date when URL-driven filters change
  useEffect(() => {
    setLocalDateRange(filters.dateRange ?? { start: null, end: null });
  }, [filters.dateRange?.start, filters.dateRange?.end]);

  const [expandedGroups, setExpandedGroups] = useState([activeTab]);

  // Sync expanded group when tab changes externally
  useEffect(() => { setExpandedGroups([activeTab]); }, [activeTab]);

  function navigate(nextFilters, nextTab) {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    router.push(buildSearchUrl(currentQuery, nextFilters, nextTab ?? activeTab));
  }

  function toggleGroup(groupId) {
    setExpandedGroups([groupId]);
    const next = { ...filters };

    if (groupId === activeTab) {
      // Re-clicking the active group → reset ALL its filters to defaults
      if (groupId === 'feedback') {
        next.from         = 'anyone';
        next.type         = 'all';
        next.verification = 'all';
        next.resolution   = 'all';
        next.category     = 'all';
        next.dateRange    = { start: null, end: null };
      } else if (groupId === 'citizen') {
        next.citizenFrom  = 'anyone';
      }
    } else {
      // Switching to a different group → reset THAT other group's filters
      if (groupId === 'citizen') {
        next.from         = 'anyone';
        next.type         = 'all';
        next.verification = 'all';
        next.resolution   = 'all';
        next.category     = 'all';
        next.dateRange    = { start: null, end: null };
      } else if (groupId === 'feedback') {
        next.citizenFrom  = 'anyone';
      }
    }

    navigate(next, groupId);
  }

  function onFilterChange(key, val) {
    const next = { ...filters, [key]: val };
    if (key === 'type' && val !== 'complaint') {
      next.verification = 'all';
      next.resolution   = 'all';
    }
    navigate(next, activeTab);
  }

  function onDateChange(val) {
    setLocalDateRange(val);
    // Navigate only when range is complete or cleared
    if ((val.start && val.end) || (!val.start && !val.end)) {
      onFilterChange('dateRange', val);
    }
  }

  return (
    <div className={styles.asideSticky}>
      <section className={styles.widget}>
        <div className={styles.widgetTitle}>
          <Funnel size={18} weight="bold" />
          <span>Filters</span>
        </div>

        {/* FEEDBACKS GROUP */}
        <div className={styles.filterGroup}>
          <button
            className={`${styles.groupToggle} ${activeTab === 'feedback' ? styles.groupActive : ''}`}
            onClick={() => toggleGroup('feedback')}
          >
            <div className={styles.groupLabel}>
              <ChatCenteredText size={18} weight={activeTab === 'feedback' ? 'duotone' : 'bold'} />
              <span>Feedbacks</span>
            </div>
            {expandedGroups.includes('feedback') ? <CaretDown size={14} /> : <CaretRight size={14} />}
          </button>

          {expandedGroups.includes('feedback') && (
            <div className={styles.groupContent}>
              <DateRangePicker
                value={localDateRange}
                onChange={onDateChange}
                placeholder="Date posted"
              />
              <SearchFilterSelect
                value={filters.from}
                onChange={val => onFilterChange('from', val)}
                options={FROM_OPTIONS}
                placeholder="Feedbacks from"
                icon={UserCircle}
                fill variant="flat" emptyValue="anyone"
              />
              <SearchFilterSelect
                value={filters.type}
                onChange={val => onFilterChange('type', val)}
                options={TYPE_OPTIONS}
                placeholder="Feedback type"
                icon={MegaphoneSimple}
                fill variant="flat"
              />
              {filters.type === 'complaint' && (
                <SearchFilterSelect
                  value={filters.verification}
                  onChange={val => onFilterChange('verification', val)}
                  options={VERIFICATION_OPTIONS}
                  placeholder="Verification Status"
                  icon={SealCheck}
                  fill variant="flat"
                />
              )}
              {filters.verification === 'verified' && (
                <SearchFilterSelect
                  value={filters.resolution}
                  onChange={val => onFilterChange('resolution', val)}
                  options={RESOLUTION_OPTIONS}
                  placeholder="Resolution Status"
                  icon={ShieldCheck}
                  fill variant="flat"
                />
              )}
              <SearchFilterSelect
                value={filters.category}
                onChange={val => onFilterChange('category', val)}
                options={[{ value: 'all', label: 'All categories' }, ...SERVICE_CATEGORY_OPTIONS]}
                placeholder="Service category"
                icon={HandHeart}
                fill variant="default"
              />
            </div>
          )}
        </div>

        {/* CITIZENS GROUP */}
        <div className={styles.filterGroup}>
          <button
            className={`${styles.groupToggle} ${activeTab === 'citizen' ? styles.groupActive : ''}`}
            onClick={() => toggleGroup('citizen')}
          >
            <div className={styles.groupLabel}>
              <Users size={18} weight={activeTab === 'citizen' ? 'duotone' : 'bold'} />
              <span>Citizens</span>
            </div>
            {expandedGroups.includes('citizen') ? <CaretDown size={14} /> : <CaretRight size={14} />}
          </button>

          {expandedGroups.includes('citizen') && (
            <div className={styles.groupContent}>
              <SearchFilterSelect
                value={filters.citizenFrom}
                onChange={val => onFilterChange('citizenFrom', val)}
                options={FROM_OPTIONS}
                placeholder="Search range"
                icon={UserCircle}
                fill emptyValue="anyone" variant="flat"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─── MAIN PAGE EXPORT ──────────────────────────────────────────────────────── */
export default function SearchPage({ initialQuery = '', initialFilters, initialTab = 'feedback' }) {
  const EMPTY_FILTERS = {
    dateRange: { start: null, end: null },
    from: 'anyone', type: 'all', verification: 'all',
    resolution: 'all', category: 'all', citizenFrom: 'anyone',
  };

  const [inputVal,  setInputVal] = useState(initialQuery);
  const [committed, setCommit]   = useState(initialQuery);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [filters,   setFilters]   = useState(initialFilters ?? EMPTY_FILTERS);

  // Sync when URL params change (new search from TopHeader or filter navigation)
  useEffect(() => { setInputVal(initialQuery); setCommit(initialQuery); }, [initialQuery]);
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  useEffect(() => {
    if (initialFilters) setFilters(initialFilters);
  }, [
    initialFilters?.type, initialFilters?.from, initialFilters?.category,
    initialFilters?.verification, initialFilters?.resolution,
    initialFilters?.dateRange?.start, initialFilters?.dateRange?.end,
  ]);

  const { results, loading } = useSearch(committed);

  return {
    feed: (
      <div className={styles.mainFeedArea}>
        <SearchResultsFeed
          committed={committed}
          activeTab={activeTab}
          filters={filters}
          results={results}
          loading={loading}
        />
      </div>
    ),
    aside: (
      <SearchAsideFilters
        activeTab={activeTab}
        filters={filters}
      />
    ),
  };
}
