import { useMemo } from 'react';
import { SmileyWink, ClockCountdown, Wrench, StarHalf, HandHeart, MapPin, PresentationChart, Calendar } from '@phosphor-icons/react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import PageSectionHeader from '../../components/ui/PageSectionHeader.jsx';
import SearchFilterSelect from '../../components/ui/SearchFilterSelect.jsx';
import { SERVICE_CATEGORY_OPTIONS } from '../../constants/index.js';
import { getMoodEmoji, formatHourMetric, TYPE_COLORS, TIME_FILTER_OPTIONS } from './LGUPageUtils.js';
import styles from './LGUPage.module.css';

export default function PerformanceTab({
  performanceService,
  setPerformanceService,
  performanceLocation,
  setPerformanceLocation,
  performanceTime,
  setPerformanceTime,
  availableLocations,
  filteredMood,
  averageResponseHours,
  resolutionRate,
  satisfactionRate,
  feedbacksChart,
  complaintsChart,
  verifiedChart,
  performanceRef
}) {
  const serviceOptions = useMemo(() => [
    { value: 'all', label: 'All services' },
    ...SERVICE_CATEGORY_OPTIONS,
  ], []);

  const locationOptions = useMemo(() => [
    { value: 'all', label: 'All locations' },
    ...availableLocations.filter(l => l !== 'all').map(l => ({ value: l, label: l }))
  ], [availableLocations]);

  return (
    <>
      <div className={styles.introOuter}>
        <div className={styles.introInner}>
          <PageSectionHeader
            className={styles.tightHeader}
            icon={PresentationChart}
            title="LGU Performance"
            actions={(
              <div className={styles.filterGroupActions}>
                <SearchFilterSelect
                  value={performanceService}
                  onChange={setPerformanceService}
                  options={serviceOptions}
                  placeholder="Filter service category"
                  icon={HandHeart}
                  fill variant="default"
                />
                <SearchFilterSelect
                  value={performanceLocation}
                  onChange={setPerformanceLocation}
                  options={locationOptions}
                  placeholder="Filter incident location"
                  icon={MapPin}
                  fill variant="default"
                />
                <SearchFilterSelect
                  value={performanceTime}
                  onChange={setPerformanceTime}
                  options={TIME_FILTER_OPTIONS}
                  placeholder="Filter time range"
                  icon={Calendar}
                  searchable={false}
                />
              </div>
            )}
          />
        </div>
      </div>

      <div className={styles.mainSection}>
        <section ref={performanceRef} className={styles.performanceSection} id="lgu-performance">
          <div className={styles.kpiGrid}>
            <article className={styles.kpiCard}>
              <div className={styles.kpiTopRow}>
                <span className={styles.kpiTitle}>Mood</span>
                <span className={styles.kpiIcon}><SmileyWink size={18} weight="duotone" /></span>
              </div>
              <div className={styles.kpiHeroEmoji}>{getMoodEmoji(filteredMood.label)}</div>
              <span className={styles.kpiValueLabel}>{filteredMood.label}</span>
              <span className={styles.kpiValueLabel}>{filteredMood.detail}</span>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiTopRow}>
                <span className={styles.kpiTitle}>Average response time</span>
                <span className={styles.kpiIcon}><ClockCountdown size={18} weight="duotone" /></span>
              </div>
              <strong className={styles.kpiValue}>{formatHourMetric(averageResponseHours)}</strong>
              <span className={styles.kpiValueLabel}>from the feedbacks</span>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiTopRow}>
                <span className={styles.kpiTitle}>Resolution rate</span>
                <span className={styles.kpiIcon}><Wrench size={18} weight="duotone" /></span>
              </div>
              <strong className={styles.kpiValue}>{resolutionRate}%</strong>
              <span className={styles.kpiValueLabel}>resolved over verified</span>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiTopRow}>
                <span className={styles.kpiTitle}>Satisfaction rate</span>
                <span className={styles.kpiIcon}><StarHalf size={18} weight="duotone" /></span>
              </div>
              <strong className={styles.kpiValue}>{satisfactionRate}%</strong>
              <span className={styles.kpiValueLabel}>positive feedback signal</span>
            </article>
          </div>

          <div className={styles.chartGrid}>
            <article className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <strong>Feedbacks</strong>
              </div>
              <div className={styles.chartBody}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={feedbacksChart} margin={{ top: 24, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                    <YAxis hide />
                    <Bar dataKey="value" radius={[6, 6, 2, 2]} barSize={70} minPointSize={4}>
                      {feedbacksChart.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      <LabelList 
                        dataKey="value" 
                        position="top" 
                        content={(props) => {
                          const { x, y, width, value } = props;
                          return (
                            <text 
                              x={x + width / 2} 
                              y={y - 10} 
                              fill="#64748b" 
                              fontSize={11} 
                              fontWeight={800} 
                              textAnchor="middle"
                            >
                              {value}
                            </text>
                          );
                        }} 
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <strong>Complaints</strong>
              </div>
              <div className={styles.chartBody}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={complaintsChart} margin={{ top: 24, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                    <YAxis hide />
                    <Bar dataKey="value" radius={[6, 6, 2, 2]} barSize={70} minPointSize={4}>
                      {complaintsChart.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      <LabelList 
                        dataKey="value" 
                        position="top" 
                        content={(props) => {
                          const { x, y, width, value } = props;
                          return (
                            <text 
                              x={x + width / 2} 
                              y={y - 10} 
                              fill="#64748b" 
                              fontSize={11} 
                              fontWeight={800} 
                              textAnchor="middle"
                            >
                              {value}
                            </text>
                          );
                        }} 
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <strong>Verified</strong>
              </div>
              <div className={styles.chartBody}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={verifiedChart} margin={{ top: 24, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                    <YAxis hide />
                    <Bar dataKey="value" radius={[6, 6, 2, 2]} barSize={70} minPointSize={4}>
                      {verifiedChart.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      <LabelList 
                        dataKey="value" 
                        position="top" 
                        content={(props) => {
                          const { x, y, width, value } = props;
                          return (
                            <text 
                              x={x + width / 2} 
                              y={y - 10} 
                              fill="#64748b" 
                              fontSize={11} 
                              fontWeight={800} 
                              textAnchor="middle"
                            >
                              {value}
                            </text>
                          );
                        }} 
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}
