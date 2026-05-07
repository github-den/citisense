import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Archive, 
  ChartDonut, 
  Star, 
  MagnifyingGlass, 
  HandHeart, 
  MapPin,
  Broadcast,
  Folders,
  Globe,
  CaretDown,
  CaretRight
} from '@phosphor-icons/react';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import Card from '../../components/ui/Card.jsx';
import Popover from '../../components/ui/Popover.jsx';
import { useApp } from '@core/context/AppContext.jsx';
import { feedboxFallback } from '../../data/feedboxFallback.js';
import { useFeedboxes } from '@core/hooks/useFeedboxes.js';
import SearchFilterSelect from '../../components/ui/SearchFilterSelect.jsx';
import { SERVICE_CATEGORIES, URDANETA_BARANGAYS } from '../../constants/index.js';
import { formatFeedboxMonthTag, formatFeedboxRating, isNewFeedbox, stripFeedboxMonthPrefix } from '@core/utils/feedboxMeta.js';
import styles from './FeedboxPage.module.css';

const STATUS_COLORS = {
  active: '#16a34a',
  resolved: '#2563eb',
  others: '#d97706',
};

function extractLocation(box) {
  return box.location || 'Other Locations';
}

function deriveStatusBreakdown(box) {
  if (box.status_breakdown) return box.status_breakdown;
  const total = Number(box.feedback_count ?? 0);
  return {
    active: Math.max(1, Math.round(total * 0.42)),
    resolved: Math.max(1, Math.round(total * 0.34)),
    others: Math.max(0, total - Math.round(total * 0.42) - Math.round(total * 0.34)),
  };
}

function getSatisfaction(box, index) {
  if (typeof box.avg_satisfaction === 'number') return box.avg_satisfaction;
  const fallback = feedboxFallback[index % feedboxFallback.length];
  return fallback.avg_satisfaction;
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

function GroupCard({ title, count, totalRaises, icon: Icon, onClick }) {
  return (
    <Card className={styles.feedboxCard}>
      <button type="button" className={styles.feedboxButton} onClick={onClick}>
        <div className={styles.cardTop}>
          <div className={styles.cardLeft}>
            <span className={styles.boxIcon}>
              <Archive size={18} weight="duotone" />
            </span>
            <span className={styles.metricCount}>{count}</span>
          </div>
        </div>
        <div className={styles.cardBody}>
          <h2 className={styles.cardTitle}>{title}</h2>
          <p className={styles.cardSub}>{totalRaises} raises</p>
        </div>
      </button>
    </Card>
  );
}

function FeedboxCard({ box, index, onOpen }) {
  const satisfaction = getSatisfaction(box, index);
  const showNew = isNewFeedbox(box.created_at);
  const dateTag = formatFeedboxMonthTag(box.created_at);

  return (
    <Card className={styles.feedboxCard}>
      <button type="button" className={styles.feedboxButton} onClick={() => onOpen(box)}>
        <div className={styles.cardTop}>
          <div className={styles.cardLeft}>
            <span className={styles.boxIcon}>
              <Archive size={18} weight="duotone" />
            </span>
            <Popover
              align="left"
              trigger={<span className={styles.metricCount}>{box.feedback_count ?? 0}</span>}
              panelClassName={styles.metricPopoverPanel}
            >
              <BreakdownPopover box={box} />
            </Popover>
          </div>

          <div className={styles.cardRight}>
            <span className={styles.ratingValue}>{formatFeedboxRating(satisfaction)}</span>
            <span className={styles.starWrap}>
              <Star size={16} weight="fill" />
            </span>
          </div>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.feedboxTagRow}>
            {showNew && <span className={styles.feedboxNewTag}>NEW</span>}
            <span className={styles.feedboxDateTag}>{dateTag}</span>
          </div>
          <h2 className={styles.cardTitle}>{stripFeedboxMonthPrefix(box.topic)}</h2>
          <p className={styles.cardSub}>
            {box.raises_count ?? 0} raises, {box.shares_count ?? 0} shares
          </p>
        </div>
      </button>
    </Card>
  );
}

export default function FeedboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openFeedbox } = useApp() ?? {};
  const { feedboxes, loading } = useFeedboxes();
  
  const urlTab = searchParams.get('tab') || 'topic';
  const urlFilter = urlTab === 'service' ? searchParams.get('category') : (urlTab === 'location' ? searchParams.get('barangay') : null);

  const [activeTab, setActiveTab] = useState(urlTab);
  const [activeSubFilter, setActiveSubFilter] = useState(urlFilter);

  useEffect(() => {
    setActiveTab(urlTab);
    setActiveSubFilter(urlFilter);
  }, [urlTab, urlFilter]);

  const services = SERVICE_CATEGORIES;
  const locations = URDANETA_BARANGAYS;

  const selectGroupFilter = (tab, filter) => {
    if (filter === 'all') {
      router.push('/feedbox?tab=topic', { scroll: false });
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
      const boxes = feedboxes.filter(box => {
        if (activeTab === 'service') return box.service === item;
        return extractLocation(box) === item;
      });
      
      return {
        label: item,
        count: boxes.length,
        totalRaises: boxes.reduce((sum, box) => sum + (box.raises_count ?? 0), 0),
        icon: activeTab === 'service' ? HandHeart : MapPin
      };
    }).sort((a, b) => b.count - a.count);
  }, [activeTab, feedboxes, services, locations]);

  const filteredFeedboxes = useMemo(() => {
    if (activeTab === 'topic') return feedboxes;
    if (!activeSubFilter || activeSubFilter === 'all') return [];
    
    return feedboxes.filter((box) => {
      if (activeTab === 'service') return box.service === activeSubFilter;
      if (activeTab === 'location') return extractLocation(box) === activeSubFilter;
      return true;
    });
  }, [feedboxes, activeTab, activeSubFilter]);

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
              Browse civic concerns grouped by topic, service, or location.
            </p>
          </div>

          <div className={styles.asideSection}>
            <nav className={styles.tabNav}>
              {/* TOPIC TAB */}
              <button
                className={`${styles.navItem} ${activeTab === 'topic' ? styles.navItemActive : ''}`}
                onClick={() => { setActiveTab('topic'); setActiveSubFilter(null); router.push('/feedbox?tab=topic', { scroll: false }); }}
              >
                <div className={styles.navItemContent}>
                  <Broadcast size={20} weight={activeTab === 'topic' ? "duotone" : "regular"} />
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

        {loading ? (
          <div className={styles.grid}>
            {Array.from({ length: 12 }).map((_, i) => (
              <FeedboxPlaceholder key={i} />
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {activeTab !== 'topic' && !activeSubFilter ? (
              groupData.map((group) => (
                <GroupCard 
                  key={group.label} 
                  title={group.label} 
                  count={group.count}
                  totalRaises={group.totalRaises}
                  icon={group.icon}
                  onClick={() => selectGroupFilter(activeTab, group.label)} 
                />
              ))
            ) : filteredFeedboxes.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyText}>No feedboxes found for the current selection.</div>
              </div>
            ) : (
              filteredFeedboxes.map((box, index) => (
                <FeedboxCard key={box.id} box={box} index={index} onOpen={(selected) => openFeedbox?.(selected)} />
              ))
            )}
            
            {/* Fill placeholders to reach multiple of 3 */}
            {((activeTab !== 'topic' && !activeSubFilter) || filteredFeedboxes.length > 0) && Array.from({ 
              length: ((activeTab !== 'topic' && !activeSubFilter ? groupData.length : filteredFeedboxes.length) % 3 === 0) ? 0 : 3 - ((activeTab !== 'topic' && !activeSubFilter ? groupData.length : filteredFeedboxes.length) % 3) 
            }).map((_, i) => (
              <FeedboxPlaceholder key={`placeholder-${i}`} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
