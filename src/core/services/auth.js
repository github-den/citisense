import { supabase } from '@core/lib/supabase.js';

const AUTH_METHOD_EMAIL = 'email';
const AUTH_METHOD_GOOGLE = 'google';
const PENDING_AUTH_METHOD_KEY = 'citisense:pending_auth_method';
const PENDING_AUTH_STARTED_AT_KEY = 'citisense:pending_auth_started_at';
const PENDING_AUTH_MAX_AGE_MS = 10 * 60 * 1000;
const PENDING_GOOGLE_AUTH_KEY = 'citisense:pending_google_auth';
const GOOGLE_AUTH_INTENT_LOGIN = 'login';
const GOOGLE_AUTH_INTENT_SIGNUP = 'signup';
const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim();

const AVATAR_ASSETS = {
  avatar_1: '/avatars/avatar_1.png',
  avatar_2: '/avatars/avatar_2.png',
  avatar_3: '/avatars/avatar_3.png',
  avatar_4: '/avatars/avatar_4.png',
  avatar_5: '/avatars/avatar_5.png',
  avatar_6: '/avatars/avatar_6.png',
  avatar_7: '/avatars/avatar_7.png',
  avatar_8: '/avatars/avatar_8.png',
  avatar_9: '/avatars/avatar_9.png',
};

function noClient() {
  throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file.');
}

function getLinkedProviders(user) {
  const providers = user?.app_metadata?.providers;
  if (Array.isArray(providers) && providers.length > 0) return providers;

  const provider = user?.app_metadata?.provider;
  return provider ? [provider] : [];
}

function getPendingAuthMethod() {
  if (typeof window === 'undefined') return null;

  const method = window.sessionStorage.getItem(PENDING_AUTH_METHOD_KEY);
  const startedAt = Number(window.sessionStorage.getItem(PENDING_AUTH_STARTED_AT_KEY) ?? 0);
  if (!method || !startedAt || Date.now() - startedAt > PENDING_AUTH_MAX_AGE_MS) {
    window.sessionStorage.removeItem(PENDING_AUTH_METHOD_KEY);
    window.sessionStorage.removeItem(PENDING_AUTH_STARTED_AT_KEY);
    return null;
  }

  return method;
}

function clearPendingAuthMethod() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_AUTH_METHOD_KEY);
  window.sessionStorage.removeItem(PENDING_AUTH_STARTED_AT_KEY);
}

function rememberPendingAuthMethod(method) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_AUTH_METHOD_KEY, method);
  window.sessionStorage.setItem(PENDING_AUTH_STARTED_AT_KEY, String(Date.now()));
}

function getAppBaseUrl() {
  if (PUBLIC_SITE_URL) return PUBLIC_SITE_URL.replace(/\/+$/, '');
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function getOAuthCallbackUrl() {
  const baseUrl = getAppBaseUrl();
  return baseUrl ? `${baseUrl}/auth/callback` : '/auth/callback';
}

async function requestAccountGate(payload) {
  const response = await fetch('/api/auth/account-gate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error ?? 'Unable to verify account registration.');
  }

  return result;
}

export function getPendingGoogleAuthState() {
  if (typeof window === 'undefined') return null;

  const raw = window.sessionStorage.getItem(PENDING_GOOGLE_AUTH_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.startedAt || Date.now() - parsed.startedAt > PENDING_AUTH_MAX_AGE_MS) {
      window.sessionStorage.removeItem(PENDING_GOOGLE_AUTH_KEY);
      return null;
    }

    return {
      intent: parsed.intent === GOOGLE_AUTH_INTENT_SIGNUP ? GOOGLE_AUTH_INTENT_SIGNUP : GOOGLE_AUTH_INTENT_LOGIN,
      acceptedTerms: parsed.acceptedTerms === true,
    };
  } catch {
    window.sessionStorage.removeItem(PENDING_GOOGLE_AUTH_KEY);
    return null;
  }
}

export function clearPendingGoogleAuthState() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_GOOGLE_AUTH_KEY);
}

export function clearPendingGoogleAuthFlow() {
  clearPendingAuthMethod();
  clearPendingGoogleAuthState();
}

export async function ensureEmailLoginAllowed(email) {
  const result = await requestAccountGate({ mode: 'email-login', email });
  if (result.allowed) return result;

  const error = new Error(result.message ?? 'Unable to log in.');
  error.authTab = result.tab ?? 'login';
  throw error;
}

export async function ensureEmailSignupAllowed(email) {
  const result = await requestAccountGate({ mode: 'email-signup', email });
  if (result.allowed) return result;

  const error = new Error(result.message ?? 'Unable to sign up.');
  error.authTab = result.tab ?? 'login';
  throw error;
}

export async function validateGoogleCallbackAccount({ email, currentUserId, intent }) {
  return requestAccountGate({
    mode: 'google-callback',
    email,
    currentUserId,
    intent,
  });
}

function rememberPendingGoogleAuthState({ intent, acceptedTerms }) {
  if (typeof window === 'undefined') return;

  window.sessionStorage.setItem(PENDING_GOOGLE_AUTH_KEY, JSON.stringify({
    intent,
    acceptedTerms: acceptedTerms === true,
    startedAt: Date.now(),
  }));
}

async function syncAuthMethodMetadata(session) {
  if (!supabase || !session?.user?.id) return session;

  const pendingMethod = getPendingAuthMethod();
  const linkedProviders = getLinkedProviders(session.user);
  const currentMetadata = session.user.user_metadata ?? {};
  const nextSignupMethod = currentMetadata.signup_method ?? currentMetadata.signup_started_with ?? pendingMethod ?? linkedProviders[0] ?? null;

  const nextMetadata = {
    signup_method: nextSignupMethod,
    signup_started_with: currentMetadata.signup_started_with ?? nextSignupMethod,
    linked_providers: linkedProviders,
  };

  const hasMetadataChanges = Object.entries(nextMetadata).some(([key, value]) => {
    const currentValue = currentMetadata[key];
    return Array.isArray(value)
      ? JSON.stringify(currentValue ?? []) !== JSON.stringify(value)
      : currentValue !== value;
  });

  if (!hasMetadataChanges) {
    if (pendingMethod) clearPendingAuthMethod();
    return session;
  }

  const { data, error } = await supabase.auth.updateUser({ data: nextMetadata });
  if (pendingMethod) clearPendingAuthMethod();
  if (error || !data?.user) return session;

  return {
    ...session,
    user: {
      ...session.user,
      user_metadata: {
        ...session.user.user_metadata,
        ...data.user.user_metadata,
      },
    },
  };
}

export async function enrichSession(session) {
  if (!supabase || !session?.user?.id) return session;

  const syncedSession = await syncAuthMethodMetadata(session);

  const { data, error } = await supabase
    .from('profiles')
    .select('username, avatar, location')
    .eq('id', syncedSession.user.id)
    .maybeSingle();

  if (error || !data) return syncedSession;

  return {
    ...syncedSession,
    user: {
      ...syncedSession.user,
      user_metadata: {
        ...syncedSession.user.user_metadata,
        role: syncedSession.user.user_metadata?.role,
        username: data.username ?? syncedSession.user.user_metadata?.username,
        avatar: data.avatar ?? syncedSession.user.user_metadata?.avatar,
        barangay: data.location ?? syncedSession.user.user_metadata?.barangay,
      },
    },
  };
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return enrichSession(data.session ?? null);
}

export async function signIn(email, password) {
  if (!supabase) noClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return enrichSession(data.session);
}

export async function signUp(email, password) {
  if (!supabase) noClient();
  await ensureEmailSignupAllowed(email);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        signup_method: AUTH_METHOD_EMAIL,
        signup_started_with: AUTH_METHOD_EMAIL,
        linked_providers: [AUTH_METHOD_EMAIL],
      },
    },
  });
  if (error) throw error;

  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('This email is already linked to an existing CitiSense account. If you used Google first, please continue with Google or set a password from Settings.');
  }

  return enrichSession(data.session);
}

export async function sendSignupOtp(email) {
  if (!supabase) noClient();
  await ensureEmailSignupAllowed(email);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: {
        signup_method: AUTH_METHOD_EMAIL,
        signup_started_with: AUTH_METHOD_EMAIL,
        linked_providers: [AUTH_METHOD_EMAIL],
      },
    },
  });
  if (error) throw error;
}

export async function verifySignupOtp(email, token) {
  if (!supabase) noClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;
  return enrichSession(data.session);
}

export async function setCurrentUserPassword(password) {
  if (!supabase) noClient();
  const { data, error } = await supabase.auth.updateUser({
    password,
    data: {
      signup_method: AUTH_METHOD_EMAIL,
      signup_started_with: AUTH_METHOD_EMAIL,
      linked_providers: [AUTH_METHOD_EMAIL],
    },
  });
  if (error) throw error;
  return data.user;
}

export async function markSignupAgreementAccepted() {
  if (!supabase) noClient();
  const acceptedAt = new Date().toISOString();
  const { data, error } = await supabase.auth.updateUser({
    data: {
      terms_accepted: true,
      terms_accepted_at: acceptedAt,
      privacy_accepted: true,
      privacy_accepted_at: acceptedAt,
    },
  });
  if (error) throw error;
  return data.user;
}

export async function updateProfile({ username, avatarId, barangay }) {
  if (!supabase) noClient();
  const avatar = AVATAR_ASSETS[avatarId] ?? AVATAR_ASSETS.avatar_1;

  const { data, error } = await supabase.auth.updateUser({
    data: {
      username,
      avatar,
      barangay,
      setup_complete: true,
    },
  });
  if (error) throw error;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      username,
      avatar,
      location: barangay,
    })
    .eq('id', data.user.id);
  if (profileError) throw profileError;

  return data.user;
}

export async function updateEmail(email) {
  if (!supabase) noClient();
  const { data, error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
  return data.user;
}

export async function resetPassword(email) {
  if (!supabase) noClient();
  const baseUrl = getAppBaseUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: baseUrl || '/',
  });
  if (error) throw error;
}

export async function signInWithGoogle({ intent = GOOGLE_AUTH_INTENT_LOGIN, acceptedTerms = false } = {}) {
  if (!supabase) noClient();
  if (intent === GOOGLE_AUTH_INTENT_SIGNUP && !acceptedTerms) {
    throw new Error('Please accept the User Agreement and Privacy Policy.');
  }

  rememberPendingAuthMethod(AUTH_METHOD_GOOGLE);
  rememberPendingGoogleAuthState({ intent, acceptedTerms });
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getOAuthCallbackUrl() },
  });
  if (error) {
    clearPendingGoogleAuthFlow();
    throw error;
  }
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    enrichSession(session)
      .then(callback)
      .catch(() => callback(session ?? null));
  });
  return () => data.subscription.unsubscribe();
}
