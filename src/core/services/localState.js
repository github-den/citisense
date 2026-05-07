const BOOKMARKED_POST_IDS_KEY = 'citisense-bookmarked-post-ids';
const FEEDBACK_DRAFTS_KEY = 'citisense-feedback-drafts';
const LEGACY_FEEDBACK_DRAFT_KEY = 'citisense-feedback-draft';
const BOOKMARKS_CHANGED_EVENT = 'citisense:bookmarks-changed';
const DRAFT_CHANGED_EVENT = 'citisense:draft-changed';

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function createDraftId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toDraftTimestamp(value) {
  const date = new Date(value ?? 0);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeDraftRecord(value) {
  if (!value || typeof value !== 'object') return null;

  const form = value.form && typeof value.form === 'object' ? value.form : value;
  return {
    id: String(value.id ?? createDraftId()),
    form,
    name: String(value.name ?? '').trim(),
    savedAt: value.savedAt ?? null,
    selectedTypes: Array.isArray(value.selectedTypes) ? value.selectedTypes.filter(Boolean) : [],
    mediaItems: Array.isArray(value.mediaItems) ? value.mediaItems : [],
  };
}

function normalizeDraftCollection(raw) {
  const parsed = safeParse(raw, []);

  if (Array.isArray(parsed)) {
    return parsed
      .map(normalizeDraftRecord)
      .filter(Boolean)
      .sort((left, right) => toDraftTimestamp(right.savedAt) - toDraftTimestamp(left.savedAt));
  }

  const legacy = normalizeDraftRecord(parsed);
  return legacy ? [legacy] : [];
}

function persistFeedbackDrafts(drafts) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(FEEDBACK_DRAFTS_KEY, JSON.stringify(drafts));
  window.localStorage.removeItem(LEGACY_FEEDBACK_DRAFT_KEY);
}

export function listBookmarkedPostIds() {
  if (!canUseStorage()) return [];
  const parsed = safeParse(window.localStorage.getItem(BOOKMARKED_POST_IDS_KEY) ?? '[]', []);
  return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
}

export function isBookmarkedPost(postId) {
  if (!postId) return false;
  return listBookmarkedPostIds().includes(postId);
}

export function setBookmarkedPost(postId, bookmarked) {
  if (!canUseStorage() || !postId) return;
  const existing = new Set(listBookmarkedPostIds());
  if (bookmarked) existing.add(postId);
  else existing.delete(postId);
  window.localStorage.setItem(BOOKMARKED_POST_IDS_KEY, JSON.stringify([...existing]));
  window.dispatchEvent(new CustomEvent(BOOKMARKS_CHANGED_EVENT));
}

export function getFeedbackDraftKey() {
  return FEEDBACK_DRAFTS_KEY;
}

export function listFeedbackDrafts() {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(FEEDBACK_DRAFTS_KEY);
  if (raw) return normalizeDraftCollection(raw);

  const legacyRaw = window.localStorage.getItem(LEGACY_FEEDBACK_DRAFT_KEY);
  if (!legacyRaw) return [];

  const migratedDrafts = normalizeDraftCollection(legacyRaw);
  if (migratedDrafts.length > 0) {
    persistFeedbackDrafts(migratedDrafts);
  }
  return migratedDrafts;
}

export function loadFeedbackDraft(draftId = null) {
  const drafts = listFeedbackDrafts() ?? [];
  if (!draftId) return drafts[0] ?? null;
  return drafts.find((draft) => draft.id === String(draftId)) ?? null;
}

export function saveFeedbackDraft(form, name = '', extras = {}) {
  if (!canUseStorage()) return;

  const nextDraft = {
    id: String(extras.id ?? createDraftId()),
    form,
    name: String(name ?? '').trim(),
    savedAt: new Date().toISOString(),
    selectedTypes: Array.isArray(extras.selectedTypes) ? extras.selectedTypes.filter(Boolean) : [],
    mediaItems: Array.isArray(extras.mediaItems) ? extras.mediaItems : [],
  };
  persistFeedbackDrafts([nextDraft, ...(listFeedbackDrafts() ?? [])]);
  window.dispatchEvent(new CustomEvent(DRAFT_CHANGED_EVENT));
  return nextDraft;
}

export function clearFeedbackDraft(draftId = null) {
  if (!canUseStorage()) return;

  if (draftId == null) {
    window.localStorage.removeItem(FEEDBACK_DRAFTS_KEY);
    window.localStorage.removeItem(LEGACY_FEEDBACK_DRAFT_KEY);
  } else {
    const nextDrafts = (listFeedbackDrafts() ?? []).filter((draft) => draft.id !== String(draftId));
    persistFeedbackDrafts(nextDrafts);
  }

  window.dispatchEvent(new CustomEvent(DRAFT_CHANGED_EVENT));
}
