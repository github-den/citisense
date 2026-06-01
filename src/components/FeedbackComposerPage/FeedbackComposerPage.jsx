import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import {
  ArrowBendUpRight,
  CheckCircle,
  HandGrabbing,
  HandHeart,
  ImageSquare,
  Lightbulb,
  MapPin,
  Paperclip,
  PencilSimpleLine,
  Star,
  Trash,
  Warning,
  WarningCircle,
} from '@phosphor-icons/react';
import PageSectionHeader from '../ui/PageSectionHeader.jsx';
import { useAuth } from '@core/context/AuthContext.jsx';
import { routes } from '@core/lib/navigation/routes.js';
import { SERVICE_CATEGORY_OPTIONS, URDANETA_BARANGAYS } from '../../constants/index.js';
import { clearFeedbackDraft, loadFeedbackDraft, saveFeedbackDraft } from '@core/services/localState.js';
import { deleteDraftMediaItems, loadDraftMediaItems, saveDraftMediaItems } from '@core/services/draftMediaStore.js';
import { createFeedbackPost } from '@core/services/posts.js';
import { uploadMediaFiles } from '@core/services/media.js';
import { lockPageScroll } from '@core/utils/lockPageScroll.js';
import { dedupeMediaItems, getMediaGridModel, inferMediaType } from '@core/utils/mediaGrid.js';
import SearchFilterSelect from '../ui/SearchFilterSelect.jsx';
import MediaCarousel from '../MediaGrid/MediaCarousel.jsx';
import { queueToastAfterNavigation } from '../Toast/Toast.jsx';
import { showToast } from '../Toast/Toast.jsx';
import { supabase } from '@core/lib/supabase.js';
import { normalizeIncidentLocationLabel } from '@core/utils/location.js';

import styles from '../../views/WriteFeedbackPage/WriteFeedbackPage.module.css';

const INCIDENT_LOCATION_OPTIONS = URDANETA_BARANGAYS.map((b) => ({ value: b, label: b }));

const TYPES = [
  { value: 'complaint', label: 'Report an issue', helper: 'A problem that needs review or action.', Icon: Warning },
  { value: 'suggestion', label: 'Suggest improvement', helper: 'A practical idea for better service.', Icon: Lightbulb },
  { value: 'compliment', label: 'Recognize good service', helper: 'Positive feedback worth noting.', Icon: Star },
];

const MAX_MEDIA_ITEMS = 10;

const INITIAL_FORM = {
  type: 'complaint',
  service: '',
  barangay: '',
  content: '',
};

function getQualityChecks(form) {
  return [
    { label: 'Clear issue or suggestion', done: form.content.trim().length >= 35 },
    { label: 'Public service selected', done: !!form.service && SERVICE_CATEGORY_OPTIONS.some(opt => opt.value === form.service) },
    { label: 'Incident location included', done: !!form.barangay && URDANETA_BARANGAYS.includes(form.barangay) },
    { label: 'Actionable context added', done: form.content.trim().split(/\s+/).length >= 12 },
  ];
}

function createLocalMediaItems(files = []) {
  return files.map((file, index) => ({
    id: `local-${Date.now()}-${index}-${file.name}`,
    src: URL.createObjectURL(file),
    type: file.type?.startsWith('video/') ? 'video' : 'image',
    file,
    isLocal: true,
    label: file.name,
  }));
}

function createDraftId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function getMonthYear(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function getFeedbackSubject(form) {
  const content = normalizeText(form.content);
  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'there', 'here', 'near', 'about', 'issue', 'problem']);
  const keywords = content
    .split(' ')
    .filter((word) => word.length > 3 && !stopWords.has(word))
    .slice(0, 4)
    .join(' ');

  return keywords || form.service || 'civic concern';
}

function CheckRow({ label, done, statusLabel }) {
  return (
    <div className={`${styles.inlineCheckRow} ${done ? styles.inlineCheckDone : ''}`}>
      <span className={done ? styles.inlineCheckIconDone : styles.inlineCheckIconLoading}>
        {done ? <CheckCircle size={18} weight="duotone" /> : ''}
      </span>
      <strong>{label}</strong>
    </div>
  );
}

function FeedbackComposerModal({
  mounted,
  title,
  body = null,
  actions = null,
  children = null,
  onClose = null,
}) {
  if (!mounted) return null;

  return createPortal(
    <div
      className={styles.draftModalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={() => onClose?.()}
    >
      <div className={styles.draftModalCard} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.draftModalTitle}>{title}</div>
        {body ? <p className={styles.draftModalBody}>{body}</p> : null}
        {children}
        {actions ? <div className={styles.modalActionRow}>{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export default function FeedbackComposerPage({ setPage }) {
  const { session, requireAuth } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [draftName, setDraftName] = useState('');
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [mediaItems, setMediaItems] = useState([]);

  const [selectedTypes, setSelectedTypes] = useState([]);
  const [validationNotice, setValidationNotice] = useState('');
  const [isPosted, setIsPosted] = useState(false);
  const [mediaDragActive, setMediaDragActive] = useState(false);

  const [shouldFocusLocation, setShouldFocusLocation] = useState(false);
  const validationTimer = useRef(null);
  const mediaRef = useRef(mediaItems);
  const fileInputRef = useRef(null);
  const searchParams = useSearchParams();

  const shortcutProcessed = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;
    const hasOpenModal = isDraftModalOpen || !!confirmModal;
    if (!hasOpenModal) return undefined;
    return lockPageScroll();
  }, [confirmModal, isDraftModalOpen, mounted]);

  useEffect(() => {
    if (shortcutProcessed.current) return;
    const shortcut = searchParams.get('shortcut');
    
    if (shortcut === 'media') {
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 1600);
      shortcutProcessed.current = true;
    }

    if (shortcut === 'location') {
      setTimeout(() => {
        setShouldFocusLocation(true);
      }, 1600);
      shortcutProcessed.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    // Priority 1: Search Params (Mentions/Shortcuts)
    const caption = searchParams.get('caption');
    const shortcut = searchParams.get('shortcut');
    if (caption || shortcut) return;

    // Priority 2: Explicit draft resume only
    const requestedDraftId = searchParams.get('draft');
    if (!requestedDraftId) return;

    const saved = loadFeedbackDraft(requestedDraftId);
    if (!saved) return;

    let cancelled = false;

    async function restoreDraft() {
      const restoredMediaItems = await loadDraftMediaItems(saved);
      if (cancelled) {
        restoredMediaItems.forEach((item) => {
          if (item?.isLocal && item?.src) URL.revokeObjectURL(item.src);
        });
        return;
      }

      setForm({ ...INITIAL_FORM, ...(saved.form ?? {}) });
      setDraftName(String(saved.name ?? ''));
      setCurrentDraftId(saved.id ?? null);
      setSelectedTypes(
        Array.isArray(saved.selectedTypes) && saved.selectedTypes.length > 0
          ? saved.selectedTypes
          : [saved.form?.type].filter(Boolean),
      );
      setMediaItems(restoredMediaItems);
    }

    restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    const editPostId = searchParams.get('edit');
    if (!editPostId) return undefined;

    let cancelled = false;

    async function restoreEdit() {
      if (editPostId.startsWith('demo-')) {
        const { listDemoPosts } = await import('@core/services/demoPosts.js');
        const demoPosts = listDemoPosts();
        const post = demoPosts.find(p => p.id === editPostId);
        if (cancelled) return;
        if (post) {
          setForm({
            type: post.type || 'complaint',
            service: post.service || '',
            barangay: post.barangay || '',
            content: post.content || '',
          });
          setSelectedTypes([post.type].filter(Boolean));
          setMediaItems(
            [post.imageUrl, ...(post.images || [])]
              .filter(Boolean)
              .map((src, i) => ({ id: `existing-${i}`, src, isLocal: false }))
          );
        }
      } else {
        const { supabase } = await import('@core/lib/supabase.js');
        if (!supabase) return;
        const { data: post, error } = await supabase
          .from('feedbacks')
          .select('*')
          .eq('id', editPostId)
          .single();

        if (cancelled) return;
        if (post && !error) {
          setForm({
            type: post.type || 'complaint',
            service: post.service || '',
            barangay: normalizeIncidentLocationLabel(post.incident_location || post.barangay || '') || '',
            content: post.caption || '',
          });
          setSelectedTypes([post.type].filter(Boolean));
          setMediaItems(
            [post.image_url, ...(post.image_urls || [])]
              .filter(Boolean)
              .map((src, i) => ({ id: `existing-${i}`, src, isLocal: false }))
          );
        }
      }
    }

    restoreEdit();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    const previous = mediaRef.current;
    const currentIds = new Set(mediaItems.map((item) => item.id));
    previous.forEach((item) => {
      if (item.isLocal && !currentIds.has(item.id)) URL.revokeObjectURL(item.src);
    });
    mediaRef.current = mediaItems;
  }, [mediaItems]);

  useEffect(() => () => {
    mediaRef.current.forEach((item) => {
      if (item.isLocal) URL.revokeObjectURL(item.src);
    });
  }, []);

  // Always start fresh when entering write mode (no edit/draft/caption params)
  useEffect(() => {
    const editPostId = searchParams.get('edit');
    const draftId = searchParams.get('draft');
    const caption = searchParams.get('caption');
    if (!editPostId && !draftId && !caption) {
      setForm(INITIAL_FORM);
      setSelectedTypes([]);
      setCurrentDraftId(null);
      setMediaItems((current) => {
        current.forEach((item) => { if (item.isLocal) URL.revokeObjectURL(item.src); });
        return [];
      });
    }
  }, [searchParams]);


  const checks = useMemo(() => getQualityChecks(form), [form]);
  const score = checks.filter((check) => check.done).length;
  const canSubmit = form.content.trim().length > 0 && !busy;
  const canAdvance = form.content.trim().length > 0 && !busy;
  const selectedType = TYPES.find((type) => type.value === form.type) ?? TYPES[0];
  const primarySelectedType = selectedTypes.includes('complaint')
    ? 'complaint'
    : selectedTypes.includes('suggestion')
      ? 'suggestion'
      : selectedTypes.includes('compliment')
        ? 'compliment'
        : '';
  const mediaModel = useMemo(() => getMediaGridModel(mediaItems, MAX_MEDIA_ITEMS), [mediaItems]);
  const displayName = session?.user?.user_metadata?.username || 'citizen';

  function toggleType(typeValue) {
    setSelectedTypes((current) => {
      const exists = current.includes(typeValue);
      if (exists && current.length === 1) {
        showValidationNotice('At least one feedback type must be selected.');
        return current;
      }
      const next = exists
        ? current.filter((item) => item !== typeValue)
        : [...current, typeValue];
      const primary = next.includes('complaint')
        ? 'complaint'
        : next.includes('suggestion')
          ? 'suggestion'
          : next.includes('compliment')
            ? 'compliment'
            : '';
      if (primary) updateField('type', primary);
      return next;
    });
  }

  function showValidationNotice(message, duration = 1500) {
    setValidationNotice(message);
    window.clearTimeout(validationTimer.current);
    if (duration !== null) {
      validationTimer.current = window.setTimeout(() => {
        setValidationNotice('');
      }, duration);
    }
  }

  function getNextValidationMessage() {
    if (selectedTypes.length === 0) return 'Please select at least one feedback type.';
    if (!form.content.trim()) return 'Please describe what exactly happened.';

    if (!form.service) return 'Please select a service category.';
    const isServiceValid = SERVICE_CATEGORY_OPTIONS.some((opt) => opt.value === form.service);
    if (!isServiceValid) return 'Please select a valid service category from the list.';

    if (!form.barangay) return 'Please select an incident location.';
    const isBarangayValid = URDANETA_BARANGAYS.includes(form.barangay);
    if (!isBarangayValid) return 'Please select a valid incident location from the list.';

    return '';
  }

  async function handleNext() {
    const message = getNextValidationMessage();
    if (message) {
      showValidationNotice(message);
      return;
    }

    const isEdit = !!searchParams.get('edit');
    setBusy(true);
    showValidationNotice(isEdit ? 'Saving changes...' : 'Posting...', null);

    try {
      await submit();
    } catch (err) {
      setBusy(false);
      showValidationNotice('Submission failed. Please try again.');
    }
  }

  function updateField(field, value) {
    setStatus(null);
    setError('');
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openSaveDraftModal() {
    setIsDraftModalOpen(true);
  }

  function closeSaveDraftModal() {
    setIsDraftModalOpen(false);
  }

  function closeConfirmModal() {
    setConfirmModal(null);
  }

  async function saveDraft() {
    const trimmedName = draftName.trim();
    if (!trimmedName || isSavingDraft) return;

    setIsSavingDraft(true);
    const draftId = createDraftId();

    try {
      const persistedMediaItems = await saveDraftMediaItems(draftId, mediaItems);
      saveFeedbackDraft(form, trimmedName, {
        id: draftId,
        selectedTypes,
        mediaItems: persistedMediaItems,
      });
    } catch {
      clearFeedbackDraft(nextDraft.id);
      setIsSavingDraft(false);
      showValidationNotice('Draft save failed. Please try again.');
      return;
    }

    setIsDraftModalOpen(false);
    setConfirmModal(null);
    setIsSavingDraft(false);
    queueToastAfterNavigation('Draft saved', {
      type: 'info',
      duration: 2600,
      navigateTo: routes.profileDrafts,
    });
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    setPage?.('back');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('citisense:flush-pending-toasts'));
    }, 220);
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setDraftName('');
    setCurrentDraftId(null);
    setSelectedTypes([]);
    setStatus(null);
    setError('');
    setMediaItems((current) => {
      current.forEach((item) => {
        if (item.isLocal) URL.revokeObjectURL(item.src);
      });
      return [];
    });
    if (currentDraftId) {
      clearFeedbackDraft(currentDraftId);
      deleteDraftMediaItems(currentDraftId).catch(() => {});
    }
  }

  function addMediaFiles(files) {
    const incoming = Array.from(files ?? [])
      .filter((file) => file.type?.startsWith('image/') || file.type?.startsWith('video/'))
      .slice(0, MAX_MEDIA_ITEMS);

    if (incoming.length === 0) return;

    setMediaItems((current) => {
      const slotsLeft = Math.max(0, MAX_MEDIA_ITEMS - current.length);
      if (slotsLeft === 0) return current;
      const nextItems = createLocalMediaItems(incoming.slice(0, slotsLeft));
      return [...current, ...nextItems];
    });
  }

  function handleMediaPick(event) {
    addMediaFiles(event.target.files);

    event.target.value = '';
  }

  function handleMediaDrop(event) {
    event.preventDefault();
    setMediaDragActive(false);
    if (mediaItems.length >= MAX_MEDIA_ITEMS) return;
    addMediaFiles(event.dataTransfer.files);
  }

  function removeMediaItem(itemId) {
    setMediaItems((current) => {
      const target = current.find((item) => item.id === itemId);
      if (target?.isLocal) URL.revokeObjectURL(target.src);
      return current.filter((item) => item.id !== itemId);
    });
  }

  function handleBackOrDiscard() {
    if (form.content.trim() || form.service || form.barangay || mediaItems.length > 0) {
      setConfirmModal('discard');
      return;
    }
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    setPage?.('feed');
  }

  function confirmDiscard() {
    resetForm();
    setConfirmModal(null);
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    setPage?.('feed');
  }

  function openPostConfirmModal() {
    setConfirmModal('post');
  }

  function confirmPost() {
    setConfirmModal(null);
    requireAuth(handleNext, 'Sign in to submit your report.');
  }

  async function submit() {
    setBusy(true);
    setError('');
    setStatus(null);

    let uploadedUrls = [];
    const localFiles = mediaItems.filter((item) => item.isLocal && item.file).map((item) => item.file);
    if (localFiles.length > 0) {
      const uploadResult = await uploadMediaFiles(localFiles, {
        ownerId: session?.user?.id ?? 'anonymous',
        folder: 'feedback',
      });

      if (uploadResult.error) {
        setBusy(false);
        setError(uploadResult.error.message ?? 'Unable to upload media items.');
        return;
      }
      uploadedUrls = uploadResult.data ?? [];
    }

    const retainedUrls = mediaItems.filter((item) => !item.isLocal).map((item) => item.src);
    const imageUrls = dedupeMediaItems([...retainedUrls, ...uploadedUrls]).slice(0, MAX_MEDIA_ITEMS);

    const editPostId = searchParams.get('edit');

    if (editPostId) {
      if (editPostId.startsWith('demo-')) {
        const { updateDemoPost } = await import('@core/services/demoPosts.js');
        updateDemoPost(editPostId, {
          content: form.content.trim(),
          type: form.type,
          service: form.service,
          barangay: form.barangay,
          location: form.barangay,
          imageUrl: imageUrls[0] ?? null,
          images: imageUrls.slice(1),
        });
      } else {
        if (!supabase) {
          setBusy(false);
          showValidationNotice('Supabase is not configured.');
          return;
        }

        const { error } = await supabase
          .from('feedbacks')
          .update({
            caption: form.content.trim(),
            type: form.type,
            service: form.service,
            incident_location: form.barangay,
            image_url: imageUrls[0] ?? null,
            image_urls: imageUrls.slice(1),
          })
          .eq('id', editPostId);

        if (error) {
          setBusy(false);
          showValidationNotice(error.message ?? 'Update failed.');
          return;
        }

        // Fire AI mood prediction in background — does not block save
        fetch('/api/feedback-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: 'mood_prediction', content: form.content.trim() }),
        })
          .then((r) => r.json().catch(() => null))
          .then((prediction) => {
            if (prediction && !prediction.error) {
              supabase.from('feedbacks').update({
                predicted_mood: prediction.mood,
                predicted_mood_confidence: prediction.confidence,
                prediction_model_version: prediction.prediction_model_version || prediction.source,
              }).eq('id', editPostId).then(() => {});
            }
          })
          .catch(() => {});
      }

      queueToastAfterNavigation('Feedback updated!', { type: 'success', duration: 2600 });
      window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
      window.setTimeout(() => {
        setPage?.('back');
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('citisense:flush-pending-toasts'));
        }, 220);
      }, 700);

      return;
    }

    const payload = {
      userId: session?.user?.id,
      content: form.content.trim(),
      type: form.type,
      service: form.service,
      barangay: form.barangay,
      location: form.barangay,
      imageUrl: imageUrls[0] ?? null,
      imageUrls: imageUrls.slice(1),
      profile: {
        username: session?.user?.user_metadata?.username,
        avatar: session?.user?.user_metadata?.avatar,
      },
      flags: [],
    };

    const result = await createFeedbackPost(payload);

    if (result.error) {
      setBusy(false);
      showValidationNotice(result.error.message ?? 'Submission failed.');
      return;
    }

    if (currentDraftId) {
      clearFeedbackDraft(currentDraftId);
      deleteDraftMediaItems(currentDraftId).catch(() => {});
    }

    queueToastAfterNavigation('Feedback posted!', { type: 'success', duration: 2600 });
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    window.setTimeout(() => {
      setPage?.('feed');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('citisense:flush-pending-toasts'));
      }, 220);
    }, 700);
  }

  function handleSubmit(e) {
    e.preventDefault();

    const message = getNextValidationMessage();
    if (message) {
      showValidationNotice(message);
      return;
    }

    if (busy) return;
    openPostConfirmModal();
  }

  return (
    <div className={styles.page}>
      <div className={styles.introOuter}>
        <div className={styles.introInner}>
          <PageSectionHeader
            className={styles.tightHeader}
            icon={PencilSimpleLine}
            title={(
              <div className={styles.inlineHeader}>
                <span>{searchParams.get('edit') ? 'Edit Feedback' : 'Write Feedback'}</span>
                <span className={styles.headerSep}>|</span>
                <span className={styles.headerSub}>
                  {searchParams.get('edit')
                    ? 'Modify your civic report details and save updates.'
                    : 'Submit a clear civic report city admins can verify and route.'}
                </span>
              </div>
            )}
            actions={validationNotice ? (
              <div
                className={[
                  styles.validationToast,
                  busy ? styles.validationToastPersistent : '',
                  (validationNotice === 'Feedback posted' || validationNotice === 'Feedback updated') ? styles.validationToastSuccess : '',
                ].filter(Boolean).join(' ')}
                role="status"
                aria-live="polite"
              >
                {(validationNotice === 'Feedback posted' || validationNotice === 'Feedback updated') ? (
                  <CheckCircle size={17} weight="fill" aria-hidden="true" />
                ) : (
                  <WarningCircle size={17} weight="fill" aria-hidden="true" />
                )}
                <span>{validationNotice}</span>
              </div>
            ) : null}
          />
        </div>
      </div>

      <div className={styles.mainSection}>
        <form className={styles.layout} onSubmit={handleSubmit}>
          <div className={styles.composerCard}>
            <div className={styles.composerColumns}>
              <div className={styles.composerColumn}>
                <section className={`${styles.composerSection} ${styles.feedbackTypeSection}`}>
                  <div>
                    <div className={styles.sectionIntro}>
                      <h2>Select the type of your feedback</h2>
                      <p>Choose one or more. The most important type will be shown first.</p>
                    </div>
                    <div className={styles.typeChoiceGroup} aria-label="Feedback type">
                      {TYPES.map((type) => {
                        const toneClass = type.value === 'complaint'
                          ? styles.typeChoiceComplaint
                          : type.value === 'suggestion'
                            ? styles.typeChoiceSuggestion
                            : styles.typeChoiceCompliment;
                        const isSelected = selectedTypes.includes(type.value);
                        const isPrimarySelected = primarySelectedType === type.value;
                        return (
                          <button
                            key={type.value}
                            type="button"
                            className={`${styles.typeChoice} ${toneClass} ${isSelected ? styles.typeChoiceActive : ''} ${isPrimarySelected ? styles.typeChoicePrimary : ''}`}
                            onClick={() => toggleType(type.value)}
                            aria-pressed={isSelected}
                          >
                            <type.Icon size={15} weight="duotone" aria-hidden="true" />
                            <span>{type.value === 'complaint' ? 'Complaint' : type.value === 'suggestion' ? 'Suggestion' : 'Compliment'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section className={styles.composerSection}>
                  <div className={styles.sectionIntro}>
                    <h2>What exactly did happen?</h2>
                  </div>
                  <textarea
                    className={styles.reportTextarea}
                    value={form.content}
                    onChange={(e) => updateField('content', e.target.value)}
                    placeholder="Share your experience with us"
                  />
                </section>

                <section className={styles.composerSection}>
                  <div className={styles.sectionIntro}>
                    <h2>Help us learn more about it</h2>
                  </div>

                  <div className={styles.detailFields}>
                    <SearchFilterSelect
                      value={form.service}
                      onChange={(value) => updateField('service', value)}
                      options={SERVICE_CATEGORY_OPTIONS}
                      placeholder="Select service category"
                      icon={HandHeart}
                      emptyValue=""
                      fill
                      direction="up"
                      variant="default"
                    />

                    <SearchFilterSelect
                      value={form.barangay}
                      onChange={(value) => updateField('barangay', value)}
                      options={INCIDENT_LOCATION_OPTIONS}
                      placeholder="Select incident location"
                      icon={MapPin}
                      emptyValue=""
                      fill
                      direction="up"
                      autoFocus={shouldFocusLocation}
                      variant="default"
                    />

                  </div>
                </section>
              </div>

              <section className={`${styles.composerSection} ${styles.composerColumn} ${styles.evidenceColumn}`}>
                <div className={styles.sectionIntro}>
                  <h2>Attach evidence</h2>
                  <p>Optional, but it can make verification much faster.</p>
                </div>

                <div
                  className={`${styles.previewMediaWrap} ${mediaDragActive ? styles.previewMediaWrapDropActive : ''}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (mediaItems.length < MAX_MEDIA_ITEMS) setMediaDragActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (mediaItems.length < MAX_MEDIA_ITEMS) setMediaDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget)) return;
                    setMediaDragActive(false);
                  }}
                  onDrop={handleMediaDrop}
                >
                  {mediaModel.total > 0 ? (
                    <MediaCarousel 
                      className={styles.previewMediaCarousel} 
                      items={mediaItems} 
                      onRemove={removeMediaItem} 
                    />
                  ) : (
                    <div className={styles.mediaCarouselPlaceholder}>
                      <HandGrabbing size={28} weight="duotone" />
                      <strong>Drag and drop</strong>
                      <span>or use the attach button</span>
                    </div>
                  )}
                </div>

                <div className={styles.mediaInputWrap}>
                  <label className={styles.mediaInputBtn}>
                    <Paperclip size={18} weight="bold" />
                    <span>Attach</span>
                    <span className={styles.mediaButtonDivider} aria-hidden="true" />
                    <span>{mediaItems.length}/{MAX_MEDIA_ITEMS}</span>
                    <input
                      ref={fileInputRef}
                      className={styles.mediaFileInput}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleMediaPick}
                    />
                  </label>
                </div>
              </section>
            </div>



            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={handleBackOrDiscard}>
                Discard changes
              </button>
              <div className={styles.actionDivider} aria-hidden="true" />
              {!searchParams.get('edit') && (
                <>
                  <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" onClick={openSaveDraftModal}>Save Draft</button>
                </>
              )}
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={busy}>
                {busy ? (searchParams.get('edit') ? 'Saving...' : 'Posting...') : (searchParams.get('edit') ? 'Save changes' : 'Post')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {isDraftModalOpen ? (
        <FeedbackComposerModal
          mounted={mounted}
          title="Make a name for this draft"
          onClose={closeSaveDraftModal}
        >
          <div className={styles.draftModalRow}>
            <input
              className={styles.draftNameInput}
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Enter draft name"
              autoFocus
            />
            <button
              type="button"
              className={`${styles.draftSaveButton} ${draftName.trim() ? styles.draftSaveButtonReady : ''}`}
              onClick={saveDraft}
              disabled={!draftName.trim() || isSavingDraft}
            >
              {isSavingDraft ? 'Saving...' : 'Save'}
            </button>
          </div>
        </FeedbackComposerModal>
      ) : null}

      {confirmModal === 'discard' ? (
        <FeedbackComposerModal
          mounted={mounted}
          title={searchParams.get('edit') ? 'Discard changes?' : 'Discard this feedback?'}
          body={searchParams.get('edit')
            ? 'Your unsaved changes will be lost. Your original feedback will remain unchanged.'
            : 'Your current changes will be removed. This action cannot be undone.'}
          onClose={closeConfirmModal}
          actions={(
            <>
              <button type="button" className={styles.modalGhostButton} onClick={closeConfirmModal}>Cancel</button>
              <button type="button" className={styles.modalGhostButton} onClick={confirmDiscard}>Discard</button>
            </>
          )}
        />
      ) : null}

      {confirmModal === 'post' ? (
        <FeedbackComposerModal
          mounted={mounted}
          title={searchParams.get('edit') ? 'Save changes?' : 'Post this feedback?'}
          body={
            searchParams.get('edit')
              ? 'This will update your feedback details and send it for re-evaluation.'
              : 'This will submit your feedback for review and publishing.'
          }
          onClose={closeConfirmModal}
          actions={(
            <>
              <button type="button" className={styles.modalGhostButton} onClick={closeConfirmModal}>Cancel</button>
              <button type="button" className={styles.modalPrimaryButton} onClick={confirmPost}>
                {searchParams.get('edit') ? 'Save' : 'Post'}
              </button>
            </>
          )}
        />
      ) : null}

    </div>
  );
}

