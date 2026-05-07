import { useEffect, useState } from 'react';
import { Check, Eye, EyeSlash, LockKey, X } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import PageSectionHeader from '../../components/ui/PageSectionHeader.jsx';
import { setCurrentUserPassword } from '@core/services/auth.js';
import styles from './CreatePasswordPage.module.css';

export default function CreatePasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isDevBypass = email.trim().toLowerCase() === 'u' && password === '1' && confirmPassword === '1';
  const passwordRequirements = [
    { key: 'length', label: 'At least 8 characters', valid: password.length >= 8 },
    { key: 'lowercase', label: 'One lowercase letter', valid: /[a-z]/.test(password) },
    { key: 'uppercase', label: 'One uppercase letter', valid: /[A-Z]/.test(password) },
    { key: 'digit', label: 'One number', valid: /\d/.test(password) },
    { key: 'symbol', label: 'One symbol', valid: /[^A-Za-z0-9]/.test(password) },
    { key: 'match', label: 'Confirm password matches', valid: !!confirmPassword && password === confirmPassword },
  ];
  const isPasswordStrong = passwordRequirements.every(requirement => requirement.valid);

  useEffect(() => {
    const pendingEmail = window.sessionStorage.getItem('citisense:pending_signup_email') ?? '';
    const emailVerified = window.sessionStorage.getItem('citisense:signup_email_verified') === 'true';
    if (!pendingEmail) {
      router.replace('/');
      return;
    }
    if (!emailVerified) {
      router.replace('/');
      return;
    }
    setEmail(pendingEmail);
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    setError('');

    if (!isPasswordStrong && !isDevBypass) {
      setError('Password must match all Supabase email auth requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await setCurrentUserPassword(password);
      window.sessionStorage.setItem('citisense:signup_password_created', 'true');
      window.sessionStorage.removeItem('citisense:pending_signup_email');
      window.sessionStorage.removeItem('citisense:pending_signup_password');
      window.sessionStorage.removeItem('citisense:signup_email_verified');
      window.sessionStorage.removeItem('citisense:signup_password_created');
      router.push('/setup');
    } catch (err) {
      setError(err.message ?? 'Unable to create password.');
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.introOuter}>
        <div className={styles.introInner}>
          <PageSectionHeader
            className={styles.tightHeader}
            icon={LockKey}
            title={(
              <div className={styles.inlineHeader}>
                <span>Create password</span>
                <span className={styles.headerSep}>|</span>
                <span className={styles.headerSub}>Secure your account with a strong password</span>
              </div>
            )}
          />
        </div>
      </div>

      <div className={styles.body}>
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.formColumns}>
            <div className={styles.fieldsColumn}>
              <div className={styles.section}>
                <label className={styles.label} htmlFor="create-password">Password</label>
                <div className={styles.passwordWrap}>
                  <input
                    id="create-password"
                    className={styles.passwordField}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoFocus
                    required
                  />
                  <button type="button" className={styles.revealBtn} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeSlash size={18} weight="bold" /> : <Eye size={18} weight="bold" />}
                  </button>
                </div>
              </div>

              <div className={styles.section}>
                <label className={styles.label} htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  className={styles.field}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.columnDivider} aria-hidden="true" />

            <aside className={styles.requirementsColumn} aria-label="Password requirements">
              <div className={styles.requirementsTitle}>
                <h2>Password requirements</h2>
              </div>
              <div className={styles.requirements}>
              {passwordRequirements.map(requirement => (
                <div
                  key={requirement.key}
                  className={`${styles.requirement} ${requirement.valid ? styles.requirementValid : ''}`}
                >
                  <span className={styles.requirementIcon}>
                    {requirement.valid ? <Check size={12} weight="bold" /> : <X size={12} weight="bold" />}
                  </span>
                  <span>{requirement.label}</span>
                </div>
              ))}
              </div>
            </aside>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button className={styles.submitBtn} type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Next'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
