'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import Button from '../../components/ui/Button.jsx';
import styles from './LGUPage.module.css';

export default function CharterStepsModal({ service, onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (service) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [service]);

  if (!service || !mounted) return null;

  const modalContent = (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.stepsModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTag}>{service.categoryName}</div>
            <h2 className={styles.modalTitle}>{service.name}</h2>
            <p className={styles.modalSub}>Step-by-step processing guide</p>
          </div>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={20} weight="bold" />
          </button>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.timeline}>
            {service.steps.map((step, index) => (
              <div key={index} className={styles.timelineItem}>
                <div className={styles.timelinePoint}>
                  <div className={styles.pointDot} />
                  {index < service.steps.length - 1 && <div className={styles.pointLine} />}
                </div>
                <div className={styles.timelineBody}>
                  <div className={styles.stepNumber}>Step {index + 1}</div>
                  <div className={styles.stepText}>{step}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.footerNote}>
            <strong>Need help?</strong> {service.contactHelp}
          </div>
          <Button variant="primary" onClick={onClose}>Understood</Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
