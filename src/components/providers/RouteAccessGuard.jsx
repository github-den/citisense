'use client';

import { useEffect } from 'react';
import { useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@core/context/AuthContext.jsx';
import { resolveRouteAccess } from '@core/lib/navigation/access-policy.js';

export default function RouteAccessGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, session, modalOpen, openModal, needsSetup } = useAuth();
  const bootPromptShownRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    const normalizedPath = pathname && pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const isAuthRoute = normalizedPath === '/auth' || normalizedPath === '/auth/callback';

    if (!session && !modalOpen && !isAuthRoute && !bootPromptShownRef.current) {
      bootPromptShownRef.current = true;
      openModal('login');
    }
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const hasPendingEmailSignup = typeof window !== 'undefined'
      && !!window.sessionStorage.getItem('citisense:pending_signup_email');
    const hasPendingGoogleAuth = typeof window !== 'undefined'
      && !!window.sessionStorage.getItem('citisense:pending_google_auth');
    const emailSignupVerified = typeof window !== 'undefined'
      && window.sessionStorage.getItem('citisense:signup_email_verified') === 'true';
    const emailSignupPasswordCreated = typeof window !== 'undefined'
      && window.sessionStorage.getItem('citisense:signup_password_created') === 'true';
    const isEmailSignupRoute = normalizedPath === '/create-password' || normalizedPath === '/agreement';
    const isEmailSignupFlow = hasPendingEmailSignup
      && (!emailSignupPasswordCreated || isEmailSignupRoute);
    const hasOAuthCallbackParams = Boolean(
      searchParams?.get('code')
      || searchParams?.get('error')
      || searchParams?.get('error_description')
      || hash.includes('access_token=')
      || hash.includes('error=')
    );
    const isGoogleAuthCallbackRoute = normalizedPath === '/auth/callback'
      || (normalizedPath === '/' && hasOAuthCallbackParams);
    const isGoogleAuthHandoff = hasPendingGoogleAuth && isGoogleAuthCallbackRoute;

    if (session && hasPendingEmailSignup && emailSignupVerified && !emailSignupPasswordCreated && normalizedPath !== '/create-password') {
      router.replace('/create-password');
      return;
    }

    if (needsSetup && session && normalizedPath !== '/setup') {
      if (isGoogleAuthHandoff) return;
      if (isEmailSignupFlow && (modalOpen || isEmailSignupRoute)) return;
      router.replace('/setup');
      return;
    }

    if (!needsSetup && session && normalizedPath === '/setup') {
      router.replace('/feed');
      return;
    }

    const decision = resolveRouteAccess({ pathname: normalizedPath, session });
    if (decision.allowed) return;

    if (decision.promptLogin && !modalOpen) {
      openModal('login', decision.promptMessage);
    }

    if (decision.redirectTo && decision.redirectTo !== pathname) {
      router.replace(decision.redirectTo);
    }
  }, [loading, modalOpen, needsSetup, openModal, pathname, router, session]);

  return null;
}
