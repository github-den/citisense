'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetPassword } from '@core/services/auth.js';
import { useAuth } from '@core/context/AuthContext.jsx';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const router = useRouter();
  const { handleSignIn, handleSignUp, handleGoogleSignIn, isAuthenticated } = useAuth();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) router.replace('/feed');
  }, [isAuthenticated, router]);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (tab === 'login') {
        await handleSignIn(email, password);
      } else {
        if (!acceptTerms) throw new Error('Please accept the Terms of Service and Privacy Policy.');
        await handleSignUp(email, password);
        setMessage('Account created. Check your inbox if email confirmation is required.');
      }
    } catch (err) {
      setError(err.message ?? 'Unable to continue.');
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Enter your email first, then request a password reset.');
      return;
    }

    setError('');
    setMessage('');
    try {
      await resetPassword(email.trim());
      setMessage('Password reset email sent.');
    } catch (err) {
      setError(err.message ?? 'Unable to send password reset.');
    }
  }

  async function handleGoogleContinue() {
    setError('');
    setMessage('');
    if (tab === 'signup' && !acceptTerms) {
      setError('Please accept the User Agreement and Privacy Policy.');
      return;
    }

    setBusy(true);

    try {
      await handleGoogleSignIn({
        intent: tab === 'signup' ? 'signup' : 'login',
        acceptedTerms: acceptTerms,
      });
    } catch (err) {
      setError(err.message ?? 'Unable to continue with Google.');
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <button type="button" className={styles.wordmark} onClick={() => router.push('/')}>
        citisense
      </button>

      <div className={styles.card}>
        <div className={styles.tabs} role="tablist" aria-label="Authentication tabs">
          {[
            { key: 'login', label: 'Log In' },
            { key: 'signup', label: 'Sign Up' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={`${styles.tab} ${tab === item.key ? styles.tabActive : ''}`}
              onClick={() => {
                setTab(item.key);
                setError('');
                setMessage('');
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>

          {tab === 'login' ? (
            <button type="button" className={styles.link} onClick={handleForgotPassword}>
              Forgot password
            </button>
          ) : (
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} />
              <span>Accept Terms of Service and Privacy Policy</span>
            </label>
          )}

          {error ? <p className={styles.error}>{error}</p> : null}
          {message ? <p className={styles.message}>{message}</p> : null}

          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? 'Please wait...' : tab === 'login' ? 'Log In' : 'Sign Up'}
          </button>

          <div className={styles.divider}><span>or</span></div>

          <button type="button" className={styles.google} disabled={busy} onClick={handleGoogleContinue}>
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
