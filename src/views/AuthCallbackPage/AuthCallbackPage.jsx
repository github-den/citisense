'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingState from '../../components/LoadingState/LoadingState.jsx';
import { supabase } from '@core/lib/supabase.js';
import {
  clearPendingGoogleAuthFlow,
  queueAuthModalFlash,
  getPendingGoogleAuthState,
  getSession,
  markSignupAgreementAccepted,
  signOut,
  validateGoogleCallbackAccount,
} from '@core/services/auth.js';
import { useAuth } from '@core/context/AuthContext.jsx';
import styles from './AuthCallbackPage.module.css';

const SESSION_RETRY_DELAY_MS = 150;
const SESSION_RETRY_LIMIT = 20;

function getOAuthParams() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return { searchParams, hashParams };
}

function getOAuthErrorMessage({ searchParams, hashParams }) {
  const errorMessage = (
    searchParams.get('error_description')
    ?? searchParams.get('error')
    ?? hashParams.get('error_description')
    ?? hashParams.get('error')
    ?? ''
  );

  return errorMessage.replace(/\+/g, ' ');
}

async function waitForSession() {
  for (let attempt = 0; attempt < SESSION_RETRY_LIMIT; attempt += 1) {
    const session = await getSession();
    if (session?.user) return session;

    await new Promise(resolve => {
      window.setTimeout(resolve, SESSION_RETRY_DELAY_MS);
    });
  }

  return null;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const { openModal } = useAuth();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function finishGoogleAuth() {
      if (!supabase) {
        throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file.');
      }

      const oauthParams = getOAuthParams();
      const providerError = getOAuthErrorMessage(oauthParams);
      if (providerError) {
        throw new Error(providerError);
      }

      const session = await waitForSession();
      if (!session?.user) {
        throw new Error('Google sign-in did not finish correctly. Please try again.');
      }

      const pendingGoogleAuth = getPendingGoogleAuthState();
      const email = session.user.email?.trim().toLowerCase();
      if (!email) {
        throw new Error('Google did not return an email address for this account.');
      }

      const gateDecision = await validateGoogleCallbackAccount({
        email,
        currentUserId: session.user.id,
        intent: pendingGoogleAuth?.intent === 'signup' ? 'signup' : 'login',
      });
      if (!gateDecision.allowed) {
        try {
          await signOut();
        } catch {
          // The auth record may already be removed during cleanup, but the user still needs the modal feedback.
        }

        clearPendingGoogleAuthFlow();
        queueAuthModalFlash({
          tab: gateDecision.tab ?? 'login',
          message: gateDecision.message ?? 'Unable to continue with Google.',
        });
        openModal(gateDecision.tab ?? 'login', gateDecision.message ?? 'Unable to continue with Google.');
        router.replace('/');
        return;
      }

      if (
        pendingGoogleAuth?.intent === 'signup'
        && pendingGoogleAuth.acceptedTerms
        && !session.user.user_metadata?.terms_accepted
      ) {
        await markSignupAgreementAccepted();
      }

      clearPendingGoogleAuthFlow();

      const setupComplete = session.user.user_metadata?.setup_complete === true;
      router.replace(setupComplete ? '/feed' : '/setup');
    }

    finishGoogleAuth()
      .catch((caughtError) => {
        clearPendingGoogleAuthFlow();
        if (!active) return;
        setError(caughtError.message ?? 'Unable to complete Google authentication.');
        setStatus('error');
      });

    return () => {
      active = false;
      };
  }, [openModal, router]);

  if (status === 'loading') {
    return <LoadingState type="full-page" />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <p className={styles.wordmark}>citisense</p>
        <h1 className={styles.title}>Google sign-in hit a snag</h1>
        <p className={styles.copy}>
          We could not finish the Google authentication handoff for this account.
        </p>
        <p className={styles.error}>{error}</p>
        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={() => router.replace('/')}>
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
