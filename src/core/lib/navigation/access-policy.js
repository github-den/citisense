import { getUserAudience, USER_ROLES } from '../auth/roles.js';
import { routes } from './routes.js';

const GUEST_ALLOWED_EXACT = new Set([
  '/',
  '/feed',
  routes.auth,
  '/auth/callback',
  '/create-password',
  '/agreement',
]);

const GUEST_ALLOWED_PATTERNS = [
  /^\/feed\/(?:for-you|forYou)$/,
  /^\/post\/[^/]+$/,
  /^\/discuss\/[^/]+$/,
  /^\/profile\/[^/]+$/,
];

function normalizePathname(pathname) {
  const value = String(pathname ?? '/');
  if (value.length > 1 && value.endsWith('/')) return value.slice(0, -1);
  return value || '/';
}

function isGuestAllowed(pathname) {
  if (GUEST_ALLOWED_EXACT.has(pathname)) return true;
  return GUEST_ALLOWED_PATTERNS.some(pattern => pattern.test(pathname));
}

function isAdminPath(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function resolveRouteAccess({ pathname, session }) {
  const normalizedPath = normalizePathname(pathname);
  const audience = getUserAudience(session);

  if (audience === USER_ROLES.GUEST) {
    if (!isGuestAllowed(normalizedPath)) {
      return {
        allowed: false,
        redirectTo: routes.root,
        promptLogin: true,
        promptMessage: 'Please sign in to access this page.',
      };
    }
    return { allowed: true };
  }

  if (isAdminPath(normalizedPath)) {
    return {
      allowed: false,
      redirectTo: routes.feed,
      promptLogin: false,
    };
  }

  return { allowed: true };
}
