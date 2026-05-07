import { useMemo, useRef, useState } from 'react';
import { charterCategories } from '../../data/civicReference.js';
import styles from '../LGUPage/LGUPage.module.css';

// Sections
import CharterSection from '../LGUPage/CharterSection.jsx';
import CharterStepsModal from '../LGUPage/CharterStepsModal.jsx';

const CHARTER_FILTER_OPTIONS = charterCategories
  .map((category) => ({ value: category.key, label: category.name }))
  .sort((a, b) => a.label.localeCompare(b.label));

const DEFAULT_CHARTER_FILTER = CHARTER_FILTER_OPTIONS[0]?.value ?? '';

export default function CharterPage() {
  const [charterFilter, setCharterFilter] = useState(DEFAULT_CHARTER_FILTER);
  const [charterQuery, setCharterQuery] = useState('');
  const [activeCharterStep, setActiveCharterStep] = useState(null);

  const charterRef = useRef(null);

  const charterItems = useMemo(() => {
    const source = charterCategories.filter((category) => category.key === charterFilter);

    const normalizedQuery = charterQuery.trim().toLowerCase();

    return source.flatMap((category) =>
      category.services.map((service) => ({
        ...service,
        categoryKey: category.key,
        categoryName: category.name,
      })),
    ).filter((service) => {
      if (!normalizedQuery) return true;
      const haystack = `${service.name} ${service.summary} ${service.office} ${service.categoryName}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [charterFilter, charterQuery]);

  return (
    <div className={styles.page}>
      <CharterSection 
        charterQuery={charterQuery}
        setCharterQuery={setCharterQuery}
        charterFilter={charterFilter}
        setCharterFilter={setCharterFilter}
        CHARTER_FILTER_OPTIONS={CHARTER_FILTER_OPTIONS}
        charterItems={charterItems}
        activeCharterStep={activeCharterStep}
        setActiveCharterStep={setActiveCharterStep}
        charterRef={charterRef}
      />

      {activeCharterStep && (
        <CharterStepsModal 
          service={activeCharterStep} 
          onClose={() => setActiveCharterStep(null)} 
        />
      )}
    </div>
  );
}
