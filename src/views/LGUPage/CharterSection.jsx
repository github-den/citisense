import { FileText, MagnifyingGlass, ClockCountdown, HandCoins, Scroll } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import PageSectionHeader from '../../components/ui/PageSectionHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import SearchFilterSelect from '../../components/ui/SearchFilterSelect.jsx';
import { HandHeart } from '@phosphor-icons/react';
import CharterStepsModal from './CharterStepsModal.jsx';
import styles from './LGUPage.module.css';

export default function CharterTab({
  charterQuery,
  setCharterQuery,
  charterFilter,
  setCharterFilter,
  CHARTER_FILTER_OPTIONS,
  charterItems,
  activeCharterStep,
  setActiveCharterStep,
  charterRef
}) {
  const router = useRouter();

  return (
    <>
      <div className={styles.introOuter}>
        <div className={styles.introInner}>
          <PageSectionHeader
            className={styles.tightHeader}
            icon={FileText}
            title="Citizen Charter"
            actions={(
              <div className={styles.filterGroupActions}>
                <label className={styles.searchField}>
                  <div className={styles.searchInputWrap}>
                    <MagnifyingGlass size={16} weight="bold" color="var(--text-3)" />
                    <input
                      type="search"
                      value={charterQuery}
                      onChange={(event) => setCharterQuery(event.target.value)}
                      placeholder="Search service"
                    />
                  </div>
                </label>
                <SearchFilterSelect
                  value={charterFilter}
                  options={CHARTER_FILTER_OPTIONS}
                  onChange={setCharterFilter}
                  icon={HandHeart}
                  variant="default"
                />
              </div>
            )}
          />
        </div>
      </div>

      <div className={styles.mainSection}>
        <section ref={charterRef} className={styles.charterSection} id="citizen-charter">
          <div className={styles.charterList}>
            {charterItems.length > 0 ? charterItems.map((item) => (
              <article key={`${item.categoryKey}-${item.name}`} className={styles.charterItem}>
                <div className={styles.charterColLeft}>
                  <div className={styles.charterTag}>{item.categoryName}</div>
                  <div className={styles.charterNameWrap}>
                    <h3 className={styles.charterName}>{item.name}</h3>
                    <div className={styles.charterSubtitle}>
                      Look for <strong>Officer-in-Charge</strong> at <strong>{item.office}</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.charterColMid}>
                  <div className={styles.statGroup}>
                    <div className={styles.statLabel}>
                      <Scroll size={14} weight="bold" />
                      <span>REQUIREMENTS:</span>
                    </div>
                    <ul className={styles.requirementsList}>
                      {item.requirements.map((req, idx) => (
                        <li key={idx}>{req}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className={styles.charterColRight}>
                  <div className={styles.statGroup}>
                    <div className={styles.statLabel}>
                      <ClockCountdown size={14} weight="bold" />
                      <span>WAITING TIME:</span>
                    </div>
                    <div className={styles.timeInfo}>
                      <span>{item.processingTime}</span>
                    </div>
                  </div>

                  <div className={styles.statGroup}>
                    <div className={styles.statLabelRow}>
                      <div className={styles.statLabel}>
                        <HandCoins size={14} weight="bold" />
                        <span>FEE:</span>
                      </div>
                      <div className={styles.feeValue}>
                        {item.fees === 'None' || item.fees.toLowerCase().includes('none') ? (
                          <span className={styles.freeBadge}>FREE</span>
                        ) : (
                          <span className={styles.feeAmount}>₱ {item.fees}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.charterColActions}>
                    <Button 
                      variant="outline" 
                      className={styles.charterActionBtn}
                      onClick={() => setActiveCharterStep(item)}
                    >
                      View timeline
                    </Button>
                    <Button 
                      variant="primary" 
                      className={styles.charterActionBtn}
                      onClick={() => router.push('/write')}
                    >
                      Write a feedback
                    </Button>
                  </div>
                </div>
              </article>
            )) : (
              <div className={styles.detailEmpty}>No service items match the current category and search.</div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
