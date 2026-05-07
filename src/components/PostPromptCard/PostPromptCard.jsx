import { Image, MapPin, Megaphone, NotePencil, UserCircle } from '@phosphor-icons/react';
import { useAuth } from '@core/context/AuthContext.jsx';
import Avatar from '../ui/Avatar.jsx';
import styles from './PostPromptCard.module.css';

export default function PostPromptCard({
  avatarBg,
  avatarInitials = 'C',
  avatarIsImage = false,
  placeholder = 'What is happening in your area?',
  onWrite,
  hideActions = false,
  className,
}) {
  const { isAuthenticated, openModal } = useAuth();

  function handlePrimary() {
    if (isAuthenticated) onWrite?.();
    else openModal?.('login');
  }

  function handleSecondary() {
    if (isAuthenticated) onWrite?.();
    else openModal?.('create');
  }

  return (
    <section className={[styles.card, className].filter(Boolean).join(' ')}>
      <div className={styles.top}>
        <Avatar 
          size="lg" 
          name={avatarInitials} 
          src={avatarIsImage ? avatarBg : undefined} 
          bg={!avatarIsImage ? avatarBg : undefined} 
        />

        <div className={styles.promptWrap}>
          <NotePencil size={18} weight="bold" className={styles.promptIcon} />
          <button className={styles.promptBtn} type="button" onClick={handlePrimary}>
            <span>{placeholder}</span>
          </button>
        </div>

        <div className={styles.topActions}>
          <button className={[styles.iconBtn, styles.mediaBtn].join(' ')} type="button" onClick={() => onWrite?.('media')} title="Add media">
            <Image size={20} weight="fill" aria-hidden="true" />
          </button>
          <button className={[styles.iconBtn, styles.locationBtn].join(' ')} type="button" onClick={() => onWrite?.('location')} title="Add location">
            <MapPin size={20} weight="fill" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!hideActions && (
        <div className={styles.bottom}>
          <div className={styles.copy}>
          </div>
          <div className={styles.actions}>
            <button className={styles.actionBtn} type="button" onClick={handlePrimary}>
              <NotePencil size={16} weight="bold" />
              <span>{isAuthenticated ? 'Write feedback' : 'Login to post'}</span>
            </button>
            <button className={styles.secondaryBtn} type="button" onClick={handleSecondary}>
              {isAuthenticated ? <Megaphone size={16} weight="bold" /> : <UserCircle size={16} weight="bold" />}
              <span>{isAuthenticated ? 'Open composer' : 'Sign up'}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
