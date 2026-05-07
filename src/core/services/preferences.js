const SETTINGS_KEY = 'citisense-user-settings';

const DEFAULT_SETTINGS = {
  notifications: {
    raises: true,
    feedbackReplies: true,
    discussionReplies: true,
    system: true,
  },
  privacy: {
    profileVisibility: 'Everyone',
    allowRaises: true,
  },
};

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

export function loadUserSettings() {
  if (!canUseStorage()) return DEFAULT_SETTINGS;
  const stored = safeParse(window.localStorage.getItem(SETTINGS_KEY) ?? 'null', null);
  if (!stored || typeof stored !== 'object') return DEFAULT_SETTINGS;

  return {
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(stored.notifications ?? {}),
    },
    privacy: {
      ...DEFAULT_SETTINGS.privacy,
      ...(stored.privacy ?? {}),
    },
  };
}

export function saveUserSettings(next) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}
