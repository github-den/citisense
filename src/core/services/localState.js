const BOOKMARKED_POST_IDS_KEY = 'citisense-bookmarked-post-ids';
const FEEDBACK_DRAFT_KEY = 'citisense-feedback-draft';

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
  window.dispatchEvent(new CustomEvent('citisense:bookmarks-changed'));
}

export function getFeedbackDraftKey() {
  return FEEDBACK_DRAFT_KEY;
}

export function loadFeedbackDraft() {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(FEEDBACK_DRAFT_KEY);
  if (!raw) return null;

  const parsed = safeParse(raw, null);
  if (!parsed || typeof parsed !== 'object') return null;

  if ('form' in parsed) {
    return {
      form: parsed.form ?? {},
      savedAt: parsed.savedAt ?? null,
    };
  }

  return {
    form: parsed,
    savedAt: null,
  };
}

export function saveFeedbackDraft(form) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    FEEDBACK_DRAFT_KEY,
    JSON.stringify({
      form,
      savedAt: new Date().toISOString(),
    }),
  );
}

export function clearFeedbackDraft() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(FEEDBACK_DRAFT_KEY);
}
