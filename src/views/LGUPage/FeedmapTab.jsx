import { MapTrifold } from '@phosphor-icons/react';
import PageSectionHeader from '../../components/ui/PageSectionHeader.jsx';
import LeafletFeedbackMap from '../../components/LeafletFeedbackMap/LeafletFeedbackMap.jsx';
import Button from '../../components/ui/Button.jsx';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import { URDANETA_CENTER, URDANETA_MAX_BOUNDS, getMarkerTone } from './CityPageUtils.js';
import styles from './CityPage.module.css';

export default function FeedmapTab({ 
  activeDrill, 
  handleDrill, 
  mapSignals, 
  selection, 
  openSignal, 
  setSelection, 
  setDrillStates, 
  overviewRef, 
  selectionRef 
}) {
  return (
    <>
      <div className={styles.introOuter}>
        <div className={styles.introInner}>
          <PageSectionHeader
            className={styles.tightHeader}
            icon={MapTrifold}
            title={(
              <div className={styles.inlineHeader}>
                <span>Feedmap</span>
                <span className={styles.headerSep}>|</span>
                <span className={styles.headerSub}>Scan feedback across Urdaneta and open a barangay to inspect reports.</span>
              </div>
            )}
          />
          <div className={styles.mapHeaderFrame}>
            {activeDrill && activeDrill.level > 0 && (
              <div className={styles.drillNav}>
                <div className={styles.drillNavTitle}>Go back to:</div>
                <button className={styles.drillNavItem} onClick={() => handleDrill(activeDrill.location, 0)}>
                  Barangay level
                </button>
                {activeDrill.level >= 2 && (
                  <button className={styles.drillNavItem} onClick={() => handleDrill(activeDrill.location, 1, 'types')}>
                    Feedback level
                  </button>
                )}
                {activeDrill.level >= 3 && (
                  <button className={styles.drillNavItem} onClick={() => handleDrill(activeDrill.location, 2, 'status')}>
                    Complaint level
                  </button>
                )}
              </div>
            )}
            <LeafletFeedbackMap
              center={URDANETA_CENTER}
              bounds={URDANETA_MAX_BOUNDS}
              signals={mapSignals}
              selectedLocation={selection?.location}
              onSelect={openSignal}
              onDrill={handleDrill}
            />
          </div>
        </div>
      </div>

      <div className={styles.selectionBar} ref={selectionRef}>
        {selection ? (
          <>
            <div className={styles.selectionLabel}>
              <span className={styles.selectionName}>
                <span className={styles.selectionPrefix}>Selected:</span>
                {selection.location} / {getMarkerTone(selection).replace(/^\w/, (c) => c.toUpperCase())} - {selection.total} feedbacks
              </span>
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setSelection(null);
                setDrillStates({});
                overviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Select another marker
            </Button>
          </>
        ) : (
          <div className={styles.selectionEmpty}>Select a marker first</div>
        )}
      </div>

      <div className={styles.mainSection}>
        <section ref={overviewRef} className={styles.overviewSection} id="feedback-map">
          {selection && (
            <div className={styles.mapDetailSection}>
              <div className={styles.detailHeader}>
                <div className={styles.detailTitle}>Feedmap / All feedbacks at {selection.location}</div>
                <button type="button" className={styles.clearDetailBtn} onClick={() => setSelection(null)}>
                  Clear
                </button>
              </div>
              {selection.posts.length > 0 ? (
                selection.posts.slice(0, 8).map((post) => <FeedCard key={post.id} post={post} />)
              ) : (
                <div className={styles.detailEmpty}>No feedbacks match this map slice yet.</div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
