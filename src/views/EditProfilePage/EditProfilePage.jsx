'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { UserCircle, WarningCircle, MapPin, At } from '@phosphor-icons/react';
import { supabase } from '@core/lib/supabase.js';
import { useAuth } from '@core/context/AuthContext.jsx';
import { URDANETA_BARANGAYS } from '../../constants/index.js';
import PageSectionHeader from '../../components/ui/PageSectionHeader.jsx';
import SearchFilterSelect from '../../components/ui/SearchFilterSelect.jsx';
import styles from './EditProfilePage.module.css';

const AVATARS = [
  { id: 'avatar_1', src: '/avatars/avatar_1.png', label: 'Classic Citi' },
  { id: 'avatar_2', src: '/avatars/avatar_2.png', label: 'Builder' },
  { id: 'avatar_3', src: '/avatars/avatar_3.png', label: 'Writer' },
  { id: 'avatar_4', src: '/avatars/avatar_4.png', label: 'Analyst' },
  { id: 'avatar_5', src: '/avatars/avatar_5.png', label: 'Helper' },
  { id: 'avatar_6', src: '/avatars/avatar_6.png', label: 'Listener' },
  { id: 'avatar_7', src: '/avatars/avatar_7.png', label: 'Reporter' },
  { id: 'avatar_8', src: '/avatars/avatar_8.png', label: 'Finder' },
];

const BARANGAY_OPTIONS = URDANETA_BARANGAYS.map(b => ({ value: b, label: b }));
function avatarPathToId(path) {
  return String(path ?? '').match(/avatar_(\d+)\.png$/)?.[0]?.replace('.png', '') || 'avatar_1';
}

export default function EditProfilePage({ embedded = false }) {
  const { session, handleCompleteSetup } = useAuth();
  const router = typeof window !== 'undefined' ? require('next/navigation').useRouter() : null;
  
  const [avatarId, setAvatarId] = useState(avatarPathToId(session?.user?.user_metadata?.avatar));
  const [username, setUsername] = useState(session?.user?.user_metadata?.username || '');
  const [barangay, setBarangay] = useState(session?.user?.user_metadata?.barangay || '');
  const [barangayQuery, setBarangayQuery] = useState(session?.user?.user_metadata?.barangay || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, taken: false, error: '' });

  useEffect(() => {
    // Force hide global scrollbars from base.css
    const originalOverflow = document.documentElement.style.overflowY;
    document.documentElement.style.overflowY = 'hidden';
    document.body.style.overflowY = 'hidden';
    
    return () => {
      document.documentElement.style.overflowY = originalOverflow;
      document.body.style.overflowY = '';
    };
  }, []);

  const usernameClean = username.toLowerCase().trim();
  const usernameTimer = useRef(null);

  // Validators
  const isEmptyUsername = usernameClean.length === 0;
  const hasInvalidChars = usernameClean.length > 0 && !/^[a-z0-9_]+$/.test(usernameClean);
  const isTooShort = usernameClean.length > 0 && usernameClean.length < 2;
  const isTooLong = usernameClean.length > 24;
  const usernameValid = usernameClean.length >= 2 && usernameClean.length <= 24 && !hasInvalidChars;

  const isBarangayTyping = barangayQuery.trim().length > 0;
  const hasAnyMatch = URDANETA_BARANGAYS.some(b => b.toLowerCase().includes(barangayQuery.toLowerCase().trim()));
  const isEmptyBarangay = !barangay || barangay.trim().length === 0;
  const barangayValid = !isEmptyBarangay && URDANETA_BARANGAYS.includes(barangay);

  useEffect(() => {
    if (!supabase || !usernameValid || usernameClean === session?.user?.user_metadata?.username?.toLowerCase()) {
      setUsernameStatus({ checking: false, taken: false, error: '' });
      return;
    }

    clearTimeout(usernameTimer.current);
    setUsernameStatus(prev => ({ ...prev, checking: true, error: '' }));

    usernameTimer.current = setTimeout(async () => {
      const { data, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', usernameClean)
        .limit(1);

      if (checkError) {
        setUsernameStatus({ checking: false, taken: false, error: '' });
        return;
      }

      const taken = Array.isArray(data) && data.length > 0 && data[0]?.id !== session?.user?.id;
      setUsernameStatus({
        checking: false,
        taken,
        error: taken ? 'This username is already taken.' : '',
      });
    }, 400);

    return () => clearTimeout(usernameTimer.current);
  }, [session?.user?.id, usernameClean, usernameValid, session?.user?.user_metadata?.username]);

  const inlineUsernameError = useMemo(() => {
    if (isEmptyUsername && showErrors) return 'Username is required.';
    if (hasInvalidChars) return 'Only letters, numbers, and underscores allowed.';
    if (isTooShort) return 'Username must be at least 2 characters.';
    if (isTooLong) return 'Username must not exceed 24 characters.';
    if (usernameStatus.taken) return 'This username is already taken.';
    return '';
  }, [isEmptyUsername, showErrors, hasInvalidChars, isTooShort, isTooLong, usernameStatus.taken]);

  const inlineBarangayError = useMemo(() => {
    if (isEmptyBarangay && showErrors) return 'Barangay is required.';
    if (isBarangayTyping && !hasAnyMatch) return 'No match found in Urdaneta.';
    return '';
  }, [isEmptyBarangay, showErrors, isBarangayTyping, hasAnyMatch]);

  async function onSubmit(e) {
    e.preventDefault();
    setShowErrors(true);

    if (busy || !usernameValid || usernameStatus.taken || !barangayValid) {
      return;
    }

    setError('');
    setBusy(true);

    try {
      await handleCompleteSetup({ 
        username: usernameClean, 
        avatarId,
        barangay,
        setup_complete: true
      });
    } catch (err) {
      setError(err.message || 'Unable to save changes. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className={embedded ? styles.embeddedContainer : styles.page}>
      {!embedded && (
        <div className={styles.introOuter}>
          <div className={styles.introInner}>
            <PageSectionHeader
              className={styles.tightHeader}
              icon={UserCircle}
              title={(
                <div className={styles.inlineHeader}>
                  <span>Edit profile</span>
                  <span className={styles.headerSep}>|</span>
                  <span className={styles.headerSub}>Update your digital identity — avatar and username</span>
                </div>
              )}
            />
          </div>
        </div>
      )}

      <div className={embedded ? styles.mainSectionEmbedded : styles.mainSection}>
        <div className={styles.layout}>
          <form className={styles.formContainer} onSubmit={onSubmit} noValidate>
            
            <div className={styles.columns}>
              {/* Column 1: Avatar Selection */}
              <div className={styles.column}>
                <section className={styles.section}>
                  <div className={styles.sectionTitle}>
                    <h2>Select your avatar</h2>
                  </div>

                  <div className={styles.avatarGrid}>
                    {AVATARS.map(av => (
                      <button
                        key={av.id}
                        type="button"
                        className={`${styles.avatarOption} ${avatarId === av.id ? styles.avatarOptionSelected : ''}`}
                        onClick={() => setAvatarId(av.id)}
                        aria-label={`Select ${av.label}`}
                      >
                        <img src={av.src} alt={av.label} draggable="false" />
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {/* Column 2: Identity Fields */}
              <div className={styles.column}>
                <section className={styles.section}>
                  <div className={styles.inputField}>
                    <div className={styles.sectionTitle}>
                      <h2>What would you like us to call you?</h2>
                    </div>
                    <div className={styles.inputRow}>
                      <div className={styles.inputWrap}>
                        <At size={16} weight="bold" color="var(--text-3)" />
                        <input
                          type="text"
                          placeholder="Enter your preferred username"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                          maxLength={30}
                        />
                      </div>
                      {inlineUsernameError && (
                        <div className={styles.inlineAlert}>
                          <WarningCircle size={14} weight="fill" />
                          <span>{inlineUsernameError}</span>
                        </div>
                      )}
                    </div>
                    <div className={styles.helperText}>
                      Username can be changed once every 30 days.
                    </div>
                  </div>

                  <div className={styles.inputField}>
                    <div className={styles.sectionTitle}>
                      <h2>Where do you live?</h2>
                    </div>
                    <div className={styles.inputRow}>
                      <div className={styles.barangayInputWrap}>
                        <SearchFilterSelect
                          value={barangay}
                          onChange={(val) => {
                            setBarangay(val);
                            setBarangayQuery(val);
                          }}
                          options={BARANGAY_OPTIONS}
                          placeholder="Select a barangay"
                          icon={MapPin}
                          emptyValue=""
                          fill
                          disabled={true}
                          variant="default"
                        />
                      </div>
                      {inlineBarangayError && (
                        <div className={styles.inlineAlert}>
                          <WarningCircle size={14} weight="fill" />
                          <span>{inlineBarangayError}</span>
                        </div>
                      )}
                    </div>
                    <div className={styles.helperText}>
                      Don't worry, this information will only be used to curate your feed.
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className={styles.actions}>
              {error && (
                <div className={styles.error}>
                  <WarningCircle size={16} weight="fill" />
                  <span>{error}</span>
                </div>
              )}
              {!embedded && (
                <button 
                  type="button" 
                  className={styles.returnBtn}
                  onClick={() => router?.push('/profile')}
                >
                  Return to profile
                </button>
              )}
              <button 
                type="submit" 
                className={styles.submitBtn} 
                disabled={busy}
              >
                <span>{busy ? 'Saving changes...' : 'Save changes'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
