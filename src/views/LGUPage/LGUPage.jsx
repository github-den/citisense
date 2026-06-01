import { useEffect, useMemo, useRef, useState } from 'react';
import { URDANETA_BARANGAYS } from '../../constants/index.js';
import { useFeedboxGroups } from '@core/hooks/useFeedboxGroups.js';
import styles from './LGUPage.module.css';

// Sections
import PerformanceSection from './PerformanceSection.jsx';

// Utils
import {
  filterPosts,
  deriveFilteredMood,
  deriveResponseTimeLabel,
  deriveSatisfactionScore,
  VERIFIED_STATUSES,
  NOT_ACCEPTED_STATUSES,
  TYPE_COLORS,
} from './LGUPageUtils.js';

export default function LGUPerformancePage() {
  const [performanceService, setPerformanceService] = useState('all');
  const [performanceLocation, setPerformanceLocation] = useState('all');
  const [performanceTime, setPerformanceTime] = useState('30');

  const performanceRef = useRef(null);
  const { posts } = useFeedboxGroups();

  const availableLocations = URDANETA_BARANGAYS;

  const performancePosts = useMemo(
    () => filterPosts(posts, performanceService, performanceLocation, performanceTime),
    [performanceLocation, performanceService, performanceTime, posts],
  );

  const filteredMood = useMemo(() => deriveFilteredMood(performancePosts), [performancePosts]);
  const verifiedCount = performancePosts.filter((post) => VERIFIED_STATUSES.includes(post.status)).length;
  const resolvedCount = performancePosts.filter((post) => post.status === 'Resolved').length;
  const resolutionRate = verifiedCount > 0 ? Math.round((resolvedCount / verifiedCount) * 100) : 0;
  const satisfactionScore = useMemo(() => deriveSatisfactionScore(performancePosts), [performancePosts]);
  const averageResponseLabel = useMemo(() => deriveResponseTimeLabel(performancePosts), [performancePosts]);

  const feedbacksChart = useMemo(() => ([
    { name: 'Complaint', value: performancePosts.filter((post) => post.type === 'complaint').length, color: TYPE_COLORS.complaint },
    { name: 'Suggestion', value: performancePosts.filter((post) => post.type === 'suggestion').length, color: TYPE_COLORS.suggestion },
    { name: 'Compliment', value: performancePosts.filter((post) => post.type === 'compliment').length, color: TYPE_COLORS.compliment },
  ]), [performancePosts]);

  const complaintsChart = useMemo(() => {
    const complaints = performancePosts.filter(p => p.type === 'complaint');
    return [
      { name: 'Under review', value: complaints.filter(p => p.status === 'Under Review').length, color: '#64748b' },
      { name: 'Verified', value: complaints.filter(p => VERIFIED_STATUSES.includes(p.status)).length, color: '#2563eb' },
      { name: 'Dismissed', value: complaints.filter(p => NOT_ACCEPTED_STATUSES.includes(p.status)).length, color: '#dc2626' },
    ];
  }, [performancePosts]);

  const verifiedChart = useMemo(() => {
    const verified = performancePosts.filter(p => p.type === 'complaint' && VERIFIED_STATUSES.includes(p.status));
    return [
      { name: 'In progress', value: verified.filter(p => p.status === 'In Progress').length, color: '#3b82f6' },
      { name: 'On hold', value: verified.filter(p => p.status === 'On Hold').length, color: '#f59e0b' },
      { name: 'Resolved', value: verified.filter(p => p.status === 'Resolved').length, color: '#16a34a' },
    ];
  }, [performancePosts]);

  return (
    <div className={styles.page}>
      <PerformanceSection 
        performanceService={performanceService}
        setPerformanceService={setPerformanceService}
        performanceLocation={performanceLocation}
        setPerformanceLocation={setPerformanceLocation}
        performanceTime={performanceTime}
        setPerformanceTime={setPerformanceTime}
        availableLocations={availableLocations}
        filteredMood={filteredMood}
        averageResponseLabel={averageResponseLabel}
        resolutionRate={resolutionRate}
        satisfactionScore={satisfactionScore}
        feedbacksChart={feedbacksChart}
        complaintsChart={complaintsChart}
        verifiedChart={verifiedChart}
        performanceRef={performanceRef}
      />
    </div>
  );
}
