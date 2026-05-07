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

function hasOutsideJurisdiction(value) {
  return /(manila|quezon city|cebu|davao|baguio|makati|pasig|taguig)/i.test(String(value ?? ''));
}

async function runFeedbackAiTask(payload) {
  const response = await fetch('/api/feedback-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('AI analysis is unavailable.');
  return response.json();
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

function findFlags(form, mediaItems) {
  const content = form.content.trim();
  const flags = [];
  const tips = [];
  let rejected = false;
  let rejectionReason = '';

  // 1. Jurisdiction Check (Blocking)
  if (hasOutsideJurisdiction(`${form.location} ${content}`)) {
    rejected = true;
    rejectionReason = 'The incident appears to be outside the vicinity of Urdaneta.';
    tips.push('Only reports within Urdaneta City are accepted.');
  }

  // Content Flags (Non-blocking)
  if (/([a-z])\1{5,}/i.test(content) || /^[^a-zA-Z0-9\s]{8,}$/.test(content.replace(/\s+/g, ''))) {
    flags.push('Gibberish');
  }

  if (content.split(/\s+/).filter(Boolean).length < 6) {
    flags.push('Lacks actionable details');
  }

  if (!form.service && !/(road|street|drain|garbage|water|permit|health|traffic|light|office|barangay|service|school|market)/i.test(content)) {
    flags.push('No civic relevance');
  }

  // 3. Jurisdiction Check
  if (mediaItems.some((item) => /(ai|generated)/i.test(item.label ?? item.src ?? ''))) {
    flags.push('AI-generated media');
  }

  if (/(09\d{9}|\b\d{11}\b|@|gmail\.com|yahoo\.com|hotmail\.com)/i.test(content)) {
    flags.push('Contains personal information');
  }

  if (/!{3,}|\b(hate|worst|useless|grabe|sobrang pangit)\b/i.test(content)) {
    flags.push('Emotional/foul language');
  }

  return {
    rejected,
    rejectionReason,
    flags: [...new Set(flags)],
    tips: [...new Set(tips)],
  };
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
  const [reviewResult, setReviewResult] = useState(null);
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

    setBusy(true);
    showValidationNotice('Posting your feedback...', null);

    try {
      // 1. Content Flags & Jurisdiction Check
      const reviewResult = await runFeedbackAiTask({
        task: 'content_flags',
        type: form.type,
        service: form.service,
        barangay: form.barangay,
        location: form.barangay,
        content: form.content,
        mediaLabels: mediaItems.map((item) => item.label).filter(Boolean),
      }).catch(() => findFlags(form, mediaItems));

      setReviewResult(reviewResult);

      if (reviewResult.rejected) {
        showValidationNotice(reviewResult.rejectionReason || 'Please review the flags below.');
        setBusy(false);
        return;
      }

      showValidationNotice('Posting your feedback...', null);

      await submit(reviewResult);
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

  async function submit(reviewResultOverride = null) {
    setBusy(true);
    setError('');
    setStatus(null);

    const currentReviewResult = reviewResultOverride || reviewResult;

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
      flags: currentReviewResult?.flags || [],
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

    showValidationNotice('Feedback posted');

    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
      
      window.setTimeout(() => {
        setPage?.('feed');
      }, 500);
    }, 1000);
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
                <span>Write Feedback</span>
                <span className={styles.headerSep}>|</span>
                <span className={styles.headerSub}>
                  Submit a clear civic report city admins can verify and route.
                </span>
              </div>
            )}
            actions={validationNotice ? (
              <div className={`${styles.validationToast} ${validationNotice === 'Feedback posted' ? styles.validationToastSuccess : ''}`} role="status" aria-live="polite">
                {validationNotice === 'Feedback posted' ? (
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
                Discard
              </button>
              <div className={styles.actionDivider} aria-hidden="true" />
              <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" onClick={openSaveDraftModal}>Save Draft</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={busy}>
                {busy ? 'Posting...' : 'Post'}
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
          title="Discard this feedback?"
          body="Your current changes will be removed. This action cannot be undone."
          onClose={closeConfirmModal}
          actions={(
            <>
              <button type="button" className={styles.modalGhostButton} onClick={closeConfirmModal}>Cancel</button>
              <button type="button" className={styles.modalDangerButton} onClick={confirmDiscard}>Discard</button>
            </>
          )}
        />
      ) : null}

      {confirmModal === 'post' ? (
        <FeedbackComposerModal
          mounted={mounted}
          title="Post this feedback?"
          body="This will submit your feedback for review and publishing."
          onClose={closeConfirmModal}
          actions={(
            <>
              <button type="button" className={styles.modalGhostButton} onClick={closeConfirmModal}>Cancel</button>
              <button type="button" className={styles.modalPrimaryButton} onClick={confirmPost}>Post</button>
            </>
          )}
        />
      ) : null}

    </div>
  );
}

