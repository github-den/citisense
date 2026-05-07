import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@core/context/AuthContext.jsx';
import { markSignupAgreementAccepted } from '@core/services/auth.js';
import styles from './AgreementPage.module.css';

export default function AgreementPage() {
  const router = useRouter();
  const { handleSignUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const pendingEmail = window.sessionStorage.getItem('citisense:pending_signup_email') ?? '';
    const pendingPassword = window.sessionStorage.getItem('citisense:pending_signup_password') ?? '';
    const emailVerified = window.sessionStorage.getItem('citisense:signup_email_verified') === 'true';
    const passwordCreated = window.sessionStorage.getItem('citisense:signup_password_created') === 'true';

    if (!pendingEmail) {
      router.replace('/');
      return;
    }

    if (!emailVerified) {
      router.replace('/');
      return;
    }

    if (!passwordCreated && !pendingPassword) {
      router.replace('/create-password');
      return;
    }

    setEmail(pendingEmail);
    setPassword(pendingPassword);
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    setError('');

    if (!accepted) {
      setError('Please agree with Privacy Policy and User Agreement before continuing.');
      return;
    }

    setBusy(true);
    try {
      if (password) {
        await handleSignUp(email, password);
      } else {
        await markSignupAgreementAccepted();
      }
      window.sessionStorage.removeItem('citisense:pending_signup_email');
      window.sessionStorage.removeItem('citisense:pending_signup_password');
      window.sessionStorage.removeItem('citisense:signup_email_verified');
      window.sessionStorage.removeItem('citisense:signup_password_created');
      router.replace('/setup');
    } catch (err) {
      setError(err.message ?? 'Unable to create account.');
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.stickyBar}>
        <h1 className={styles.pageTitle}>Review account agreement</h1>
      </div>

      <div className={styles.body}>
        <aside className={styles.previewWrap}>
          <span className={styles.previewStep}>3. Agreement</span>
          <div className={styles.previewMark}>CS</div>
          <span className={styles.previewName}>Almost ready</span>
          <span className={styles.previewUsername}>{email || 'email'}</span>
        </aside>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.stepHeader}>
            <span className={styles.stepNo}>4. Consent</span>
            <div>
              <div className={styles.stepTitle}>Privacy Policy and User Agreement</div>
              <div className={styles.stepSub}>Please review the basic account rules before setup.</div>
            </div>
          </div>

          <div className={styles.policyBox}>
            <h2>Privacy Policy</h2>
            <p>CitiSense uses your account information to authenticate you, secure your activity, and connect civic feedback to your profile.</p>
            <p>Your public posts, username, avatar, and discussions may be visible to other users. Avoid sharing private personal data in feedback content.</p>

            <h2>User Agreement</h2>
            <p>Use CitiSense for truthful civic feedback about public services, local issues, and community concerns.</p>
            <p>Do not post threats, harassment, spam, false reports, or private information about other people.</p>
          </div>

          <label className={styles.agreeRow}>
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>I agree with Privacy Policy and User Agreement</span>
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submitBtn} type="submit" disabled={busy || !accepted}>
            {busy ? 'Creating account...' : 'Continue to setup'}
          </button>
        </form>
      </div>
    </div>
  );
}
