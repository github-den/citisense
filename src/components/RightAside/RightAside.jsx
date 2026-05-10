import { useEffect } from 'react';
import FeedAside from './FeedAside.jsx';
import FeedboxAside from './FeedboxAside.jsx';
import SearchAside from './SearchAside.jsx';
import TrackAside from './TrackAside.jsx';
import DiscussAside from './DiscussAside.jsx';
import SetupAside from './SetupAside.jsx';
import CitiMoodAside from './CitiMoodAside.jsx';
import NotificationsAside from './NotificationsAside.jsx';
import DefaultAside from './DefaultAside.jsx';
import styles from './RightAside.module.css';

export default function RightAside(props) {
  const { page, onReady } = props;

  let content = <DefaultAside />;

  switch (page) {
    case 'feed':
      content = <FeedAside {...props} />;
      break;
    case 'search':
      content = <SearchAside {...props} />;
      break;
    case 'feedbox':
      content = <FeedboxAside {...props} />;
      break;
    case 'track':
      content = <TrackAside {...props} />;
      break;
    case 'discuss':
      content = <DiscussAside {...props} />;
      break;
    case 'setup':
      content = <SetupAside {...props} />;
      break;
    case 'citimood':
      content = <CitiMoodAside {...props} />;
      break;
    case 'notifications':
      content = <NotificationsAside {...props} />;
      break;
    default:
      content = <DefaultAside {...props} />;
      break;
  }

  useEffect(() => {
    if (page !== 'feed') onReady?.();
  }, [onReady, page]);

  return (
    <aside className={styles.aside}>
      {content}
      <footer className={styles.asideFooter}>
        <div className={styles.footerRow}>
          <span className={styles.footerWordmark}>citisense</span>
          <span className={styles.footerSep}>&nbsp;&nbsp;&nbsp;</span>
          <span>© 2026 CitiSense. All Rights Reserved.</span>
        </div>
        <div className={styles.footerRow}>
          <button type="button" className={styles.footerLink}>Privacy Policy</button>
          <span className={styles.footerSep}>&nbsp;&nbsp;&nbsp;</span>
          <button type="button" className={styles.footerLink}>User Agreement</button>
          <span className={styles.footerSep}>&nbsp;&nbsp;&nbsp;</span>
          <a
            className={styles.footerLink}
            href="/citizens-charter.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Citizen's Charter
          </a>
        </div>
      </footer>
    </aside>
  );
}
