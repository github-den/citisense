import { SignOut, SignIn, UserPlus } from '@phosphor-icons/react';
import NavBtn from '../NavBtn/NavBtn.jsx';
import { useAuth } from '@core/context/AuthContext.jsx';
import styles from './LeftSidebar.module.css';

const GROUP_1 = [
  { key: 'feed', icon: 'House', label: 'Feed' },
  { key: 'feedbox', icon: 'Archive', label: 'Feedbox' },
  { key: 'track', icon: 'Crosshair', label: 'Track' },
];

const GROUP_2 = [
  { key: 'lgu', icon: 'Buildings', label: 'LGU' },
];

const GROUP_3 = [
  { key: 'profile', icon: 'UserCircle', label: 'Profile' },
  { key: 'notifications', icon: 'Bell', label: 'Notifications' },
  { key: 'saved', icon: 'BookmarkSimple', label: 'Saved' },
  { key: 'drafts', icon: 'NotePencil', label: 'Drafts' },
];

const GROUP_SETTINGS = [
  { key: 'settings', icon: 'GearSix', label: 'Settings and privacy' },
  { key: 'help', icon: 'Question', label: 'Help Center' },
];

export default function LeftSidebar({ page, setPage }) {
  const { isAuthenticated, handleSignOut, openModal } = useAuth();

  return (
    <nav className={styles.sidebar}>
      <div className={styles.top}>
        <div className={styles.logoWrap}>
          <div className={styles.logoRow}>
            <span className={styles.logoMark}>citisense</span>
            <span className={styles.cityBadge}>Urdaneta</span>
          </div>
          <div className={styles.logoSub}>Citizen Feedback Platform</div>
        </div>

        <div className={styles.sectionLabel}>Core</div>
        <div className={styles.navLinks}>
          {GROUP_1.map((item) => (
            <NavBtn
              key={item.key}
              iconName={item.icon}
              label={item.label}
              active={page === item.key}
              onClick={() => setPage(item.key)}
            />
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.sectionLabel}>City context</div>
        <div className={styles.navLinks}>
          {GROUP_2.map((item) => (
            <NavBtn
              key={item.key}
              iconName={item.icon}
              label={item.label}
              active={page === item.key}
              onClick={() => setPage(item.key)}
            />
          ))}
        </div>

        <div className={styles.divider} />

        {isAuthenticated ? (
          <>
            <div className={styles.sectionLabel}>Personal</div>
            <button className={styles.primaryAction} onClick={() => setPage('writefb')} type="button">
              Write feedback
            </button>
            <div className={styles.navLinks}>
              {GROUP_3.map((item) => (
                <NavBtn
                  key={item.key}
                  iconName={item.icon}
                  label={item.label}
                  active={page === item.key}
                  onClick={() => setPage(item.key)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className={styles.guestGroup}>
            <span className={styles.guestLabel}>Join CitiSense</span>
            <button className={styles.guestBtn} onClick={() => openModal('login')} type="button">
              <span className={styles.ni}><SignIn size={22} /></span>
              <span>Login</span>
            </button>
            <button className={styles.guestBtn} onClick={() => openModal('create')} type="button">
              <span className={styles.ni}><UserPlus size={22} /></span>
              <span>Sign up</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.bottom}>
        {isAuthenticated && (
          <>
            <div className={styles.sectionLabel}>Support</div>
            <div className={styles.navLinks}>
              {GROUP_SETTINGS.map((item) => (
                <NavBtn
                  key={item.key}
                  iconName={item.icon}
                  label={item.label}
                  active={page === item.key}
                  onClick={() => setPage(item.key)}
                />
              ))}
            </div>
            <div className={styles.divider} />
          </>
        )}

        {isAuthenticated ? (
          <button className={styles.logoutBtn} onClick={handleSignOut} type="button">
            <span className={styles.ni}><SignOut size={22} /></span>
            <span>Log out</span>
          </button>
        ) : null}
      </div>
    </nav>
  );
}
