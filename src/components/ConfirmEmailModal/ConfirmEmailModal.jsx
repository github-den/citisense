import { EnvelopeSimple, X } from '@phosphor-icons/react';
import { useAuth } from '@core/context/AuthContext.jsx';
import styles from './ConfirmEmailModal.module.css';

export default function ConfirmEmailModal() {
  const { confirmEmailOpen, confirmEmail, closeConfirmEmail } = useAuth();

  if (!confirmEmailOpen) return null;

  return (
    <div className={styles.overlay} onMouseDown={closeConfirmEmail}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>

        <div className={styles.header}>
          <span className={styles.iconWrap}>
            <EnvelopeSimple size={28} weight="fill" color="var(--brand)" />
          </span>
          <div className={styles.titleRow}>
            <span className={styles.title}>Check your email</span>
            <button className={styles.closeBtn} onClick={closeConfirmEmail} aria-label="Close">
              <X size={18} weight="bold" />
            </button>
          </div>
          <span className={styles.sub}>
            We sent a confirmation link to{' '}
            {confirmEmail && <strong className={styles.email}>{confirmEmail}</strong>}.
            {' '}Click it to verify your account and continue.
          </span>
        </div>

        <button className={styles.okBtn} onClick={closeConfirmEmail}>
          Got it
        </button>

      </div>
    </div>
  );
}
