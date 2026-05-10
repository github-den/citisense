import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/server/supabaseAdmin.js';

const AUTH_METHOD_EMAIL = 'email';
const AUTH_METHOD_GOOGLE = 'google';
const MODE_EMAIL_LOGIN = 'email-login';
const MODE_EMAIL_SIGNUP = 'email-signup';
const MODE_GOOGLE_CALLBACK = 'google-callback';
const INTENT_LOGIN = 'login';
const INTENT_SIGNUP = 'signup';
const GOOGLE_PROVISION_GRACE_MS = 5 * 60 * 1000;
const GOOGLE_PROVISION_MATCH_WINDOW_MS = 60 * 1000;
const ADMIN_ROLES = new Set(['super_admin', 'lgu_admin', 'barangay_admin', 'admin']);

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function normalizeRole(role) {
  return String(role ?? '').trim().toLowerCase();
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

function getLinkedProviders(user) {
  const appProviders = Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : [];
  const identityProviders = Array.isArray(user?.identities)
    ? user.identities.map(identity => identity?.provider).filter(Boolean)
    : [];
  const singleProvider = user?.app_metadata?.provider ? [user.app_metadata.provider] : [];

  return [...new Set([...appProviders, ...identityProviders, ...singleProvider])];
}

function getPrimaryAuthMethod(user) {
  const metadata = user?.user_metadata ?? {};
  const explicitMethod = [metadata.signup_method, metadata.signup_started_with]
    .find(value => value === AUTH_METHOD_EMAIL || value === AUTH_METHOD_GOOGLE);
  if (explicitMethod) return explicitMethod;

  const providers = getLinkedProviders(user);
  if (providers.includes(AUTH_METHOD_GOOGLE)) return AUTH_METHOD_GOOGLE;
  if (providers.includes(AUTH_METHOD_EMAIL)) return AUTH_METHOD_EMAIL;
  return null;
}

function getUserRole(user) {
  return normalizeRole(
    user?.user_metadata?.role
    || user?.app_metadata?.role,
  );
}

function isFreshGoogleProvision(user) {
  if (!user || getPrimaryAuthMethod(user) !== AUTH_METHOD_GOOGLE) return false;
  if (user.user_metadata?.setup_complete === true) return false;

  const createdAt = Date.parse(user.created_at ?? '');
  if (!Number.isFinite(createdAt)) return false;
  if (Date.now() - createdAt > GOOGLE_PROVISION_GRACE_MS) return false;

  const lastSignInAt = Date.parse(user.last_sign_in_at ?? '');
  if (Number.isFinite(lastSignInAt) && Math.abs(lastSignInAt - createdAt) > GOOGLE_PROVISION_MATCH_WINDOW_MS) {
    return false;
  }

  return true;
}

async function listUsersByEmail(admin, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];

  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data?.users ?? [];
    users.push(...batch.filter(user => normalizeEmail(user.email) === normalizedEmail));

    if (!data?.nextPage || batch.length < perPage) break;
    page = data.nextPage;
  }

  return users;
}

function allow() {
  return { allowed: true, tab: 'login', message: '' };
}

function reject(message, tab = 'login', cleanupCurrentUser = false, currentUserId = null) {
  return {
    allowed: false,
    message,
    tab,
    cleanupCurrentUser,
    currentUserId,
  };
}

function buildEmailLoginDecision(matches) {
  if (matches.some(match => match.isAdmin)) {
    return reject('Admin accounts must sign in through the admin workspace.');
  }

  const hasEmailAccount = matches.some(match => match.method === AUTH_METHOD_EMAIL);
  const hasGoogleAccount = matches.some(match => match.method === AUTH_METHOD_GOOGLE);

  if (!matches.length) {
    return reject("This account isn't registered yet. Please sign up first.", 'create');
  }

  if (!hasEmailAccount && hasGoogleAccount) {
    return reject('This account is registered using Google. Please continue with Google instead.');
  }

  return allow();
}

function buildEmailSignupDecision(matches) {
  if (matches.some(match => match.isAdmin)) {
    return reject('Admin accounts must use the admin workspace. Citizen sign-up is not available for admin accounts.');
  }

  if (matches.some(match => match.method === AUTH_METHOD_GOOGLE)) {
    return reject('This account is registered using Google. Please continue with Google instead.');
  }

  if (matches.some(match => match.method === AUTH_METHOD_EMAIL)) {
    return reject('This account is already registered. Please log in instead.');
  }

  return allow();
}

function buildGoogleCallbackDecision(matches, currentUserId, intent) {
  const currentUser = matches.find(match => match.id === currentUserId) ?? null;
  const otherMatches = matches.filter(match => match.id !== currentUserId);
  const currentMethod = currentUser?.method ?? null;
  const currentIsFreshGoogle = isFreshGoogleProvision(currentUser);
  const currentIsAdmin = currentUser?.isAdmin === true;
  const hasOtherAdminAccount = otherMatches.some(match => match.isAdmin);
  const hasOtherEmailAccount = otherMatches.some(match => match.method === AUTH_METHOD_EMAIL);
  const hasOtherGoogleAccount = otherMatches.some(match => match.method === AUTH_METHOD_GOOGLE);

  if (!currentUser) {
    const tab = intent === INTENT_SIGNUP ? 'create' : 'login';
    return reject('Unable to verify this Google account. Please try again.', tab);
  }

  if (currentMethod === AUTH_METHOD_EMAIL || hasOtherEmailAccount) {
    return reject(
      'This account is registered using direct email. Please log in with email instead.',
      'login',
      currentIsFreshGoogle,
      currentUser.id,
    );
  }

  if (intent === INTENT_SIGNUP) {
    if (hasOtherGoogleAccount || !currentIsFreshGoogle) {
      return reject(
        'This account is already registered. Please log in instead.',
        'login',
        currentIsFreshGoogle && hasOtherGoogleAccount,
        currentUser.id,
      );
    }

    return allow();
  }

  if (hasOtherGoogleAccount && currentIsFreshGoogle) {
    return reject(
      'This account is already registered. Please log in instead.',
      'login',
      true,
      currentUser.id,
    );
  }

  if (currentMethod !== AUTH_METHOD_GOOGLE) {
    return reject('Unable to verify this Google account. Please try again.');
  }

  if (currentIsFreshGoogle) {
    return reject(
      "This account isn't registered yet. Please sign up first.",
      'create',
      true,
      currentUser.id,
    );
  }

  if (currentIsAdmin || hasOtherAdminAccount) {
    return reject(
      'Admin accounts must sign in through the admin workspace.',
      'login',
      currentIsFreshGoogle,
      currentUser.id,
    );
  }

  return allow();
}

export async function POST(request) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase admin is not configured.' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const mode = String(body?.mode ?? '');
  const email = normalizeEmail(body?.email);

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  try {
    const users = await listUsersByEmail(admin, email);
    const matches = users.map(user => ({
      id: user.id,
      email: normalizeEmail(user.email),
      method: getPrimaryAuthMethod(user),
      role: getUserRole(user),
      isAdmin: isAdminRole(getUserRole(user)),
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      user_metadata: user.user_metadata ?? {},
    }));

    let decision;
    if (mode === MODE_EMAIL_LOGIN) {
      decision = buildEmailLoginDecision(matches);
    } else if (mode === MODE_EMAIL_SIGNUP) {
      decision = buildEmailSignupDecision(matches);
    } else if (mode === MODE_GOOGLE_CALLBACK) {
      const currentUserId = String(body?.currentUserId ?? '');
      const intent = body?.intent === INTENT_SIGNUP ? INTENT_SIGNUP : INTENT_LOGIN;

      if (!currentUserId) {
        return NextResponse.json({ error: 'Current user ID is required.' }, { status: 400 });
      }

      decision = buildGoogleCallbackDecision(matches, currentUserId, intent);
      if (!decision.allowed && decision.cleanupCurrentUser && decision.currentUserId) {
        await admin.auth.admin.deleteUser(decision.currentUserId);
      }
    } else {
      return NextResponse.json({ error: 'Unsupported auth gate mode.' }, { status: 400 });
    }

    return NextResponse.json(decision);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message ?? 'Unable to verify account registration.' },
      { status: 500 },
    );
  }
}
