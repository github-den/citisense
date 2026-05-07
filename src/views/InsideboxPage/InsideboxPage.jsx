import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChartLineUp, Clock, Faders, Sparkle, WarningCircle } from '@phosphor-icons/react';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import { useFeedboxPosts } from '@core/hooks/useFeedboxPosts.js';
import { supabase } from '@core/lib/supabase.js';
import styles from './InsideboxPage.module.css';

const OFFICE_BY_SERVICE = {
  'Roads and drainage': 'City Engineering Office',
  'Waste collection': 'City Environment and Natural Resources Office',
  'Street lighting': 'City Engineering Office',
  'Water service': 'Water District / Utilities Office',
  'Health services': 'City Health Office',
  'Traffic and transport': 'Traffic Management Office',
  'Public safety': 'Public Safety Office',
  'Permits and documents': 'City Hall Records / Permits Office',
};

function extractPlace(topic) {
  const t = (topic ?? '').toLowerCase();
  const idx = t.lastIndexOf(' sa ');
  if (idx === -1) return '';
  return (topic ?? '').slice(idx + 4).trim();
}

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) {
    const key = (v ?? '').trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [k, c] of counts.entries()) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best;
}

function computeVerification(posts) {
  const list = posts ?? [];
  const hasProgress = list.some((p) => p?.status && p.status !== 'Under Review');
  if (!hasProgress) return { verified: false, resolution: 'Not yet verified', window: 'Not yet verified' };

  const allResolved = list.length > 0 && list.every((p) => p.status === 'Resolved');
  const anyInProgress = list.some((p) => p.status === 'In Progress');

  const verificationStart = list
    .filter((p) => p?.status && p.status !== 'Under Review')
    .reduce((min, p) => {
      const t = new Date(p.created_at).getTime();
      return Number.isFinite(t) ? Math.min(min, t) : min;
    }, Number.POSITIVE_INFINITY);

  const startMs = Number.isFinite(verificationStart) ? verificationStart : Date.now();
  const ageDays = (Date.now() - startMs) / (1000 * 60 * 60 * 24);

  const sla = 14;
  const window = ageDays <= 7 ? 'Early' : ageDays <= sla ? 'On time' : 'Overdue';

  const resolution = allResolved ? 'Resolved' : anyInProgress ? 'In progress' : 'Verified';
  return { verified: true, resolution, window };
}

export default function InsideboxPage({ feedbox, onBack, setActiveFeedbox }) {
  const [sort, setSort] = useState('popular');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef(null);
  const { popular, recent, loading, error, raw } = useFeedboxPosts(feedbox?.id);
  const [satisfaction, setSatisfaction] = useState(null);

  const list = sort === 'recent' ? recent : popular;

  const verification = useMemo(() => computeVerification(raw ?? []), [raw]);
  const locationPrecise = useMemo(() => {
    const fallback = extractPlace(feedbox?.topic);
    const byBarangay = mostCommon((raw ?? []).map((r) => r.barangay));
    const byLocation = mostCommon((raw ?? []).map((r) => r.location));
    return byBarangay || byLocation || fallback || 'Urdaneta';
  }, [feedbox?.topic, raw]);

  const officeInCharge = OFFICE_BY_SERVICE[feedbox?.service] || (feedbox?.service ? 'Assigned office' : 'Not specified yet');

  useEffect(() => {
    if (!filtersOpen) return undefined;
    function onPointerDown(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) setFiltersOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [filtersOpen]);

  useEffect(() => {
    if (!supabase) return;
    if (!verification.verified) {
      setSatisfaction(null);
      return;
    }
    if (verification.resolution !== 'Resolved') {
      setSatisfaction(null);
      return;
    }
    const ids = (raw ?? []).map((r) => r.id).filter(Boolean);
    if (ids.length === 0) {
      setSatisfaction(null);
      return;
    }

    let mounted = true;
    supabase
      .from('reactions')
      .select('emoji, created_at, post_id')
      .in('post_id', ids)
      .limit(2000)
      .then(({ data, error: reactErr }) => {
        if (!mounted) return;
        if (reactErr || !Array.isArray(data) || data.length === 0) {
          setSatisfaction(null);
          return;
        }
        const positive = data.filter((r) => r.emoji === '🤝' || r.emoji === '😊').length;
        const rate = Math.round((positive / data.length) * 100);
        setSatisfaction(`${rate}%`);
      });

    return () => {
      mounted = false;
    };
  }, [raw, verification.resolution, verification.verified]);

  useEffect(() => {
    if (!feedbox?.id) return;
    setActiveFeedbox?.({
      ...feedbox,
      is_verified: verification.verified,
      location_precise: locationPrecise,
      office_in_charge: officeInCharge,
      resolution_window: verification.window,
      resolution_status: verification.verified ? verification.resolution : 'Not yet verified',
      satisfaction_rate: verification.resolution === 'Resolved' ? (satisfaction || 'Not enough data') : 'Not yet resolved',
    });
  }, [
    feedbox,
    feedbox?.id,
    locationPrecise,
    officeInCharge,
    satisfaction,
    setActiveFeedbox,
    verification.resolution,
    verification.verified,
    verification.window,
  ]);

  if (!feedbox) return null;

  return (
    <div>
      <div className={styles.stickyBar}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} weight="bold" />
        </button>

        <div className={styles.titleBlock}>
          <div className={styles.titleRow}>
            <span className={styles.crumb}>Feedbox</span>
            <span className={styles.sep}>/</span>
            <h1 className={styles.pageTitle}>{feedbox.topic}</h1>
          </div>
        </div>

        <div className={styles.filterWrap} ref={filterRef}>
          <button
            className={`${styles.filterBtn} ${filtersOpen ? styles.filterActive : ''}`}
            onClick={() => setFiltersOpen((value) => !value)}
            type="button"
            aria-label="Insidebox filters"
            aria-expanded={filtersOpen}
          >
            <Faders size={18} weight="bold" />
          </button>
          {filtersOpen && (
            <div className={styles.filterPanel}>
              <button
                className={`${styles.filterOption} ${sort === 'popular' ? styles.filterOptionActive : ''}`}
                type="button"
                onClick={() => {
                  setSort('popular');
                  setFiltersOpen(false);
                }}
              >
                <Sparkle size={15} weight="fill" />
                <span>Popular</span>
                <small>Balanced by raises and feedback activity</small>
              </button>
              <button
                className={`${styles.filterOption} ${sort === 'recent' ? styles.filterOptionActive : ''}`}
                type="button"
                onClick={() => {
                  setSort('recent');
                  setFiltersOpen(false);
                }}
              >
                <Clock size={15} weight="bold" />
                <span>Recent</span>
                <small>Latest feedback first, prioritizing the last 24 hours</small>
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className={styles.loading}>Loading feedbox feedback...</div>
      )}

      {!loading && error && (
        <div className={styles.empty}>
          <WarningCircle size={44} weight="duotone" color="var(--amber)" />
          <p>Feedbox could not load.</p>
          <span>Check the database connection or try again.</span>
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <div className={styles.empty}>
          <ChartLineUp size={44} weight="duotone" color="var(--text-3)" />
          <p>No feedback in this feedbox yet.</p>
          <span>Feedback will appear here once citizens start submitting reports for this topic.</span>
        </div>
      )}

      {!loading && !error && list.map((post) => (
        <FeedCard key={post.id} post={post} />
      ))}
    </div>
  );
}
