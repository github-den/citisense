import { useMemo, useState } from 'react';
import {
  ArrowSquareOut,
  Check,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  GearSix,
  LockKey,
  PencilSimple,
  Info,
  MagnifyingGlass,
  RocketLaunch,
  ClipboardText,
  ShieldCheck,
  Warning,
  CaretDown,
  ChatCircle,
} from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@core/context/AuthContext.jsx';
import Button from '../../components/ui/Button.jsx';
import { loadUserSettings, saveUserSettings } from '@core/services/preferences.js';
import { resetPassword, updateEmail } from '@core/services/auth.js';
import styles from './SettingsPage.module.css';

const TOPICS = [
  {
    key: 'getting-started',
    title: 'Getting Started',
    icon: RocketLaunch,
    description: 'Learn how CitiSense works before you post or track feedback.',
    faqs: [
      ['What is CitiSense?', 'CitiSense is a civic feedback platform where citizens can report issues, discuss service concerns, and follow the progress of public feedback.'],
      ['Do I need an account?', 'You can browse public feedback as a guest, but posting, saving, reacting, and tracking your own activity work best when signed in.'],
    ],
  },
  {
    key: 'writing-feedback',
    title: 'Writing Feedback',
    icon: ClipboardText,
    description: 'Write clearer, stronger reports that are easier to verify.',
    faqs: [
      ['What makes a useful feedback post?', 'The strongest posts explain what happened, where it happened, when it happened, and what public service is involved.'],
      ['Can I save a draft?', 'Yes. You can save a draft while writing and continue later from the Drafts page.'],
    ],
  },
  {
    key: 'feedbox-verification',
    title: 'Feedbox & Verification',
    icon: ShieldCheck,
    description: 'Understand clustering, review flow, and status updates.',
    faqs: [
      ['What is a feedbox?', 'A feedbox groups similar civic concerns so related feedback can be reviewed together and understood in one context.'],
      ['What does verification mean?', 'Verification helps confirm that a report is specific enough, relevant to public service, and reviewable by the system or admin team.'],
    ],
  },
  {
    key: 'account-privacy',
    title: 'Account & Privacy',
    icon: LockKey,
    description: 'Manage identity, visibility, and security options.',
    faqs: [
      ['Can I control who sees my profile?', 'Yes. The Settings & Privacy page lets you choose profile visibility and notification preferences.'],
      ['How do I change my password?', 'Use the Settings & Privacy page to trigger a secure password reset flow to your email.'],
    ],
  },
  {
    key: 'reporting-blocking',
    title: 'Reporting & Blocking',
    icon: Warning,
    description: 'Keep discussions useful, factual, and safe.',
    faqs: [
      ['When should I report someone?', 'Use report tools for harassment, spam, off-topic abuse, private information, or unsafe behavior.'],
      ['What happens after I report?', 'Reports help moderators review behavior and keep the civic discussion space safer and more useful.'],
    ],
  },
];

function maskEmail(email) {
  const value = String(email ?? '');
  const [local, domain] = value.split('@');
  if (!local || !domain) return 'No email available';
  return `${local.slice(0, 2)}***@${domain}`;
}
export default function SettingsPage({ setPage, embedded = false }) {
  const router = useRouter();
  const { session } = useAuth();
  const [savedKey, setSavedKey] = useState('');
  const [emailDraft, setEmailDraft] = useState(session?.user?.email ?? '');
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailNotice, setEmailNotice] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Support state
  const [openMap, setOpenMap] = useState({});

  function toggleAccordion(question) {
    setOpenMap((prev) => ({
      ...prev,
      [question]: !prev[question],
    }));
  }

  function flashSaved(key) {
    setSavedKey(key);
    window.clearTimeout(flashSaved.timer);
    flashSaved.timer = window.setTimeout(() => setSavedKey(''), 2000);
  }



  async function saveEmail() {
    const trimmed = emailDraft.trim();
    if (!trimmed) {
      setEmailError('Email is required.');
      return;
    }

    try {
      setEmailBusy(true);
      setEmailError('');
      await updateEmail(trimmed);
      setEmailNotice('Email update requested. Check your inbox for confirmation.');
      setEditingEmail(false);
    } catch (error) {
      setEmailError(error.message ?? 'Unable to update email right now.');
    } finally {
      setEmailBusy(false);
    }
  }

  async function sendResetLink() {
    try {
      await resetPassword(session?.user?.email ?? '');
      setEmailNotice('Password reset link sent to your email.');
    } catch (error) {
      setEmailNotice(error.message ?? 'Unable to start password reset.');
    }
  }


  function savedInline(key) {
    if (savedKey !== key) return null;
    return (
      <span className={styles.savedInline}>
        <Check size={13} weight="bold" />
        Saved
      </span>
    );
  }

  return (
    <div className={embedded ? styles.embeddedContainer : styles.page}>
      <div className={[styles.headerBlock, embedded ? styles.embeddedHeaderBlock : ''].filter(Boolean).join(' ')}>
        <div className={styles.titleRow}>
          <div className={styles.iconWrap}>
            <GearSix size={20} weight="fill" />
          </div>
          <h1 className={styles.pageTitle}>Settings</h1>
        </div>
      </div>

      <div className={[styles.content, embedded ? styles.embeddedContent : ''].filter(Boolean).join(' ')}>
        <div className={styles.group}>
          <div className={styles.row}>
            <div className={styles.rowMain}>
              <EnvelopeSimple size={18} weight="fill" />
              {!editingEmail ? (
                <div className={styles.rowValue}>{maskEmail(session?.user?.email)}</div>
              ) : (
                <div className={styles.inlineEdit}>
                  <input value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} placeholder="Enter new email" />
                  <div className={styles.inlineActions}>
                    <button type="button" className={styles.inlineGhost} onClick={() => { setEditingEmail(false); setEmailDraft(session?.user?.email ?? ''); setEmailError(''); }}>Cancel</button>
                    <button type="button" className={styles.inlinePrimary} onClick={saveEmail} disabled={emailBusy}>{emailBusy ? 'Saving...' : 'Save'}</button>
                  </div>
                </div>
              )}
              {emailError && <div className={styles.errorText}>{emailError}</div>}
            </div>
            {!editingEmail && (
              <Button variant="outline" size="md" onClick={() => setEditingEmail(true)}>
                Change email
              </Button>
            )}
          </div>

          <div className={styles.row}>
            <div className={styles.rowMain}>
              <LockKey size={18} weight="fill" />
              <div className={styles.passwordWrap}>
                <span className={styles.rowValue}>••••••••</span>
                <button type="button" className={styles.unhideButton} onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} weight="bold" />}
                </button>
              </div>
            </div>
            <Button variant="outline" size="md" onClick={sendResetLink}>
              Change password
            </Button>
          </div>
        </div>

        {emailNotice && <div className={styles.notice}>{emailNotice}</div>}
      </div>

      <div
        className={[styles.headerBlock, embedded ? styles.embeddedHeaderBlock : ''].filter(Boolean).join(' ')}
        style={{ marginTop: '24px' }}
      >
        <div className={styles.titleRow}>
          <div className={styles.iconWrap}>
            <Info size={20} weight="fill" />
          </div>
          <h1 className={styles.pageTitle}>Support</h1>
        </div>
      </div>

      <div className={[styles.content, embedded ? styles.embeddedContent : ''].filter(Boolean).join(' ')}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <div className={styles.accordionList}>
            {TOPICS.flatMap(t => t.faqs).map(([question, answer]) => {
              const open = !!openMap[question];
              return (
                <div key={question} className={styles.accordionItem}>
                  <button type="button" className={styles.accordionBtn} onClick={() => toggleAccordion(question)}>
                    <span>{question}</span>
                    <CaretDown size={16} weight="bold" className={open ? styles.openCaret : ''} />
                  </button>
                  {open && <div className={styles.accordionBody}>{answer}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.section} style={{ marginTop: '32px' }}>
          <div className={styles.row}>
            <div className={styles.rowMain}>
              <div className={styles.rowLabel}>User Agreement</div>
            </div>
            <Button variant="outline" size="md" onClick={() => router.push('/agreement')}>
              View
              <ArrowSquareOut size={16} />
            </Button>
          </div>

          <div className={styles.row}>
            <div className={styles.rowMain}>
              <div className={styles.rowLabel}>Privacy Policy</div>
            </div>
            <Button variant="outline" size="md" onClick={() => router.push('/agreement?tab=privacy')}>
              View
              <ArrowSquareOut size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
