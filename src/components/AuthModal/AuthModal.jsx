import { useState, useEffect } from 'react';
import { ArrowLeft, Check, EnvelopeSimple, Eye, EyeSlash, LockKey, X } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@core/context/AuthContext.jsx';
import { resetPassword, sendSignupOtp } from '@core/services/auth.js';
import styles from './AuthModal.module.css';

const OTP_DURATION_SECONDS = 5 * 60;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

export default function AuthModal() {
  const router = useRouter();
  const { modalOpen, modalMessage, modalTab, handleSignIn, handleVerifySignupOtp, handleGoogleSignIn, closeModal, continueAsGuest } = useAuth();

  const [tab, setTab] = useState('login');
  const [view, setView] = useState('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState(Array(6).fill(''));
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(OTP_DURATION_SECONDS);
  const [showPassword, setShowPassword] = useState(false);
  const [legalView, setLegalView] = useState(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isCreate = tab === 'create';

  useEffect(() => {
    if (modalOpen) {
      setTab(modalTab ?? 'login');
      setView('main');
      setEmail('');
      setPassword('');
      setOtpCode(Array(6).fill(''));
      setOtpSecondsLeft(OTP_DURATION_SECONDS);
      setShowPassword(false);
      setLegalView(null);
      setAcceptedTerms(false);
      setError(modalMessage ?? '');
      setBusy(false);
    }
  }, [modalMessage, modalOpen, modalTab]);

  useEffect(() => {
    if (!modalOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [modalOpen]);

  useEffect(() => {
    if (view !== 'otp' || otpSecondsLeft <= 0) return undefined;

    const timer = window.setInterval(() => {
      setOtpSecondsLeft(seconds => Math.max(seconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [otpSecondsLeft, view]);

  if (!modalOpen) return null;

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (isCreate && !acceptedTerms) {
      setError('Please accept the User Agreement and Privacy Policy.');
      return;
    }

    if (isCreate) {
      setBusy(true);
      try {
        window.sessionStorage.setItem('citisense:pending_signup_email', email.trim());
        await sendSignupOtp(email.trim());
        setOtpSecondsLeft(OTP_DURATION_SECONDS);
        setView('otp');
        setBusy(false);
      } catch (err) {
        setError(err.message ?? 'Unable to send verification code.');
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      await handleSignIn(email, password);
    } catch (err) {
      setError(err.message ?? 'Something went wrong.');
      setBusy(false);
    }
  }

  async function submitOtp(e) {
    e.preventDefault();
    setError('');

    const cleanCode = otpCode.join('');
    if (otpSecondsLeft <= 0) {
      setError('This code has expired. Please resend a new code.');
      return;
    }

    if (cleanCode.length !== 6) {
      setError('Enter the 6-digit code sent to your email.');
      return;
    }

    setBusy(true);
    try {
      await handleVerifySignupOtp(email.trim(), cleanCode);
      window.sessionStorage.setItem('citisense:signup_email_verified', 'true');
      window.sessionStorage.setItem('citisense:signup_password_created', 'false');
      closeModal();
      router.push('/create-password');
    } catch (err) {
      setError(err.message ?? 'Unable to verify the code.');
      setBusy(false);
    }
  }

  async function resendOtp() {
    setError('');
    setBusy(true);
    try {
      await sendSignupOtp(email.trim());
      setOtpCode(Array(6).fill(''));
      setOtpSecondsLeft(OTP_DURATION_SECONDS);
    } catch (err) {
      setError(err.message ?? 'Unable to resend the code.');
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await resetPassword(email);
      setView('forgotSent');
    } catch (err) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function submitGoogle() {
    setError('');
    if (isCreate && !acceptedTerms) {
      setError('Please accept the User Agreement and Privacy Policy.');
      return;
    }

    setBusy(true);
    try {
      await handleGoogleSignIn({
        intent: isCreate ? 'signup' : 'login',
        acceptedTerms,
      });
    } catch (err) {
      setError(err.message ?? 'Unable to continue with Google.');
      setBusy(false);
    }
  }

  function switchTab(nextTab) {
    setTab(nextTab);
    setError('');
    setView('main');
    setPassword('');
    setOtpCode(Array(6).fill(''));
    setOtpSecondsLeft(OTP_DURATION_SECONDS);
    setShowPassword(false);
  }

  function updateOtpDigit(index, value) {
    const digits = value.replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length > 1) {
      const nextCode = Array(6).fill('');
      digits.forEach((digit, digitIndex) => {
        if (index + digitIndex < 6) nextCode[index + digitIndex] = digit;
      });
      setOtpCode(nextCode);
      document.getElementById(`signup-otp-${Math.min(index + digits.length, 5)}`)?.focus();
      return;
    }

    setOtpCode(current => {
      const nextCode = [...current];
      nextCode[index] = digits[0] ?? '';
      return nextCode;
    });

    if (digits[0] && index < 5) {
      document.getElementById(`signup-otp-${index + 1}`)?.focus();
    }
  }

  function handleOtpKeyDown(index, event) {
    if (event.key === 'Backspace' && !otpCode[index] && index > 0) {
      document.getElementById(`signup-otp-${index - 1}`)?.focus();
    }
  }

  function handleOtpPaste(index, event) {
    event.preventDefault();
    updateOtpDigit(index, event.clipboardData.getData('text'));
  }

  function formatOtpTimer(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  function ModalHeader() {
    return (
      <div className={styles.header}>
        <div className={styles.brandLockup}>
          <div className={styles.brandMark}>citisense</div>
          <div className={styles.brandSub}>Citizen Feedback Platform</div>
        </div>
        <button className={styles.closeBtn} onClick={closeModal} aria-label="Close">
          <X size={18} weight="bold" />
        </button>
      </div>
    );
  }

  if (legalView) {
    const isTerms = legalView === 'terms';
    return (
      <div className={styles.overlay} onMouseDown={closeModal}>
        <div className={`${styles.modal} ${styles.legalModal}`} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
          <ModalHeader />

          <button className={styles.backBtn} onClick={() => setLegalView(null)}>
            <ArrowLeft size={16} weight="bold" />
            <span>Back to sign up</span>
          </button>

          <div className={styles.legalDoc}>
            <p className={styles.legalKicker}>CitiSense policy</p>
            <h2>{isTerms ? 'User Agreement' : 'Privacy Policy'}</h2>
            <p className={styles.legalUpdated}>Last updated: May 1, 2026. This notice explains the expected rules for using CitiSense and how account and civic feedback data are handled in the platform.</p>

            {isTerms ? (
              <>
                <h3>Purpose of CitiSense</h3>
                <p>CitiSense is a citizen feedback platform for reporting public service concerns, infrastructure issues, sanitation matters, safety observations, transportation problems, and other community concerns that may need review by authorized personnel.</p>
                <h3>Account responsibility</h3>
                <p>You are responsible for the activity made through your account. Use accurate registration details, keep your login credentials private, and notify the platform administrator if you believe your account has been accessed without permission.</p>
                <h3>Acceptable use</h3>
                <p>Submit feedback in good faith and keep discussions factual, respectful, and relevant to civic service delivery. Do not use CitiSense to harass others, impersonate another person, upload malicious content, advertise unrelated services, or disrupt the platform.</p>
                <h3>Feedback accuracy</h3>
                <p>You should provide information that is true to the best of your knowledge. Reports may include descriptions, categories, images, locations, and discussion replies. False, misleading, duplicate, or abusive reports may be limited, reclassified, hidden, or removed.</p>
                <h3>Privacy and safety</h3>
                <p>Do not post sensitive personal information such as government ID numbers, private addresses, phone numbers, medical details, financial details, passwords, or information about minors unless it is necessary and appropriate for the concern being reported.</p>
                <h3>Moderation and administrative action</h3>
                <p>Authorized administrators may review submissions, update statuses, assign categories, moderate discussions, restrict abusive accounts, and remove content that violates this agreement or creates safety, privacy, legal, or operational risks.</p>
                <h3>Platform information</h3>
                <p>Status labels, analytics, counts, and summaries are provided to help citizens and administrators monitor feedback activity. They are not a substitute for official notices, emergency channels, or legally certified government records.</p>
                <h3>Emergency use</h3>
                <p>CitiSense is not an emergency response system. If there is immediate danger, a crime in progress, a medical emergency, fire, disaster, or another urgent threat, contact the appropriate emergency hotline or local authority directly.</p>
                <h3>Changes to this agreement</h3>
                <p>The platform may update this agreement when features, policies, or legal requirements change. Continued use of CitiSense after updates means you accept the revised terms.</p>
              </>
            ) : (
              <>
                <h3>Information we collect</h3>
                <p>CitiSense may collect account details such as email address, username, display name, avatar or profile image, authentication provider, and account setup status. It may also collect feedback posts, categories, descriptions, images, location details you provide, discussion replies, reactions, bookmarks, reports, and related timestamps.</p>
                <h3>How we use information</h3>
                <p>Information is used to create and secure accounts, receive and organize civic feedback, show relevant public discussions, support moderation, route concerns by category, provide status updates, generate platform analytics, and help administrators understand recurring community issues.</p>
                <h3>Public visibility</h3>
                <p>Feedback posts, discussion content, usernames, avatars, public profile details, reaction counts, and status information may be visible to other users. Avoid including private or sensitive personal data in posts, comments, images, or location descriptions.</p>
                <h3>Administrative access</h3>
                <p>Authorized administrators may access feedback details, account identifiers, reports, moderation records, and platform activity needed to operate CitiSense, respond to concerns, investigate abuse, and maintain the integrity of the civic feedback space.</p>
                <h3>Service providers and storage</h3>
                <p>CitiSense uses Supabase for authentication, database, storage, and access control services. Data may be processed through the infrastructure used by the platform to provide login, file upload, database, security, and application functions.</p>
                <h3>Security measures</h3>
                <p>The platform uses authentication controls, database policies, role-based access, and administrative permissions to reduce unauthorized access. No online service can guarantee absolute security, so users should also protect their credentials and avoid posting sensitive information.</p>
                <h3>Data retention</h3>
                <p>Account and feedback data may be retained while your account exists, while a report remains relevant to public service review, or as needed for moderation, audit, security, backup, or legal purposes. Deleted content may persist temporarily in backups or logs.</p>
                <h3>Your choices</h3>
                <p>You may update available profile settings, choose what information to include in feedback, and request help with account or privacy concerns through the platform administrator. Some information may need to be retained if required for security, abuse prevention, or public service documentation.</p>
                <h3>Policy updates</h3>
                <p>This policy may be updated when CitiSense changes features, data practices, service providers, or legal requirements. The updated version will apply once posted in the platform.</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'forgot' || view === 'forgotSent') {
    return (
      <div className={styles.overlay} onMouseDown={closeModal}>
        <div className={styles.modal} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
          <ModalHeader />

          <button className={styles.backBtn} onClick={() => { setView('main'); setError(''); }}>
            <ArrowLeft size={16} weight="bold" />
            <span>Back to login</span>
          </button>

          {view === 'forgotSent' ? (
            <div className={styles.forgotSent}>
              <div className={styles.successIcon}>
                <EnvelopeSimple size={26} weight="fill" />
              </div>
              <p className={styles.forgotSentTitle}>Check your email</p>
              <p className={styles.forgotSentSub}>
                We sent a password reset link to <strong>{email}</strong>. Follow it to set a new password.
              </p>
            </div>
          ) : (
            <>
              <p className={styles.forgotHeading}>Reset your password</p>
              <p className={styles.forgotSub}>Enter your account email and we'll send a secure reset link.</p>
              <form className={styles.form} onSubmit={submitForgot}>
                <label className={styles.fieldGroup}>
                  <span className={styles.label}>Email address</span>
                  <span className={styles.inputWrap}>
                    <EnvelopeSimple size={17} weight="bold" />
                    <input
                      className={styles.field}
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </span>
                </label>
                {error && <p className={styles.error}>{error}</p>}
                <button className={styles.submitBtn} type="submit" disabled={busy}>
                  {busy ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  if (view === 'otp') {
    return (
      <div className={styles.overlay} onMouseDown={closeModal}>
        <div className={styles.modal} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
          <ModalHeader />

          <button className={styles.backBtn} onClick={() => { setView('main'); setError(''); setOtpCode(Array(6).fill('')); }}>
            <ArrowLeft size={16} weight="bold" />
            <span>Back to sign up</span>
          </button>

          <div className={styles.otpIntro}>
            <p className={styles.forgotHeading}>Verify your email</p>
            <p className={styles.forgotSub}>
              Enter the 6-digit code sent to <strong>{email}</strong>.
            </p>
            <p className={styles.otpTimer}>Code expires in {formatOtpTimer(otpSecondsLeft)}</p>
          </div>

          <form className={styles.form} onSubmit={submitOtp}>
            <label className={styles.fieldGroup}>
              <span className={styles.label}>Email OTP</span>
              <span className={styles.otpRow}>
                {otpCode.map((digit, index) => (
                  <input
                    key={index}
                    id={`signup-otp-${index}`}
                    className={styles.otpDigit}
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    aria-label={`OTP digit ${index + 1}`}
                    value={digit}
                    onChange={e => updateOtpDigit(index, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(index, e)}
                    onPaste={e => handleOtpPaste(index, e)}
                    autoFocus={index === 0}
                    required
                  />
                ))}
              </span>
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button className={styles.submitBtn} type="submit" disabled={busy}>
              {busy ? 'Verifying...' : 'Verify email'}
            </button>
          </form>

          <button className={styles.resendCodeBtn} type="button" onClick={resendOtp} disabled={busy}>
            {otpSecondsLeft <= 0 ? 'Send new code' : 'Resend code'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onMouseDown={closeModal}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <ModalHeader />



        <div className={styles.tabs}>
          <button type="button" className={`${styles.tabBtn} ${tab === 'login' ? styles.active : ''}`} onClick={() => switchTab('login')}>
            Login
          </button>
          <button type="button" className={`${styles.tabBtn} ${tab === 'create' ? styles.active : ''}`} onClick={() => switchTab('create')}>
            Sign up
          </button>
        </div>

        <form className={styles.form} onSubmit={submit}>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>{tab === 'login' ? 'Email or username' : 'Email address'}</span>
            <span className={styles.inputWrap}>
              <EnvelopeSimple size={17} weight="bold" />
              <input
                className={styles.field}
                type={tab === 'login' || isCreate ? 'text' : 'email'}
                placeholder={tab === 'login' ? 'Enter email or username' : 'citisense@email.com'}
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus={tab === 'login'}
                required
              />
            </span>
          </label>

          {isCreate && (
            <div className={styles.termsRow}>
              <input 
                type="checkbox" 
                id="terms" 
                checked={acceptedTerms} 
                onChange={e => setAcceptedTerms(e.target.checked)} 
              />
              <label className={styles.checkboxBox} htmlFor="terms" aria-hidden="true">
                {acceptedTerms && <Check size={13} weight="bold" />}
              </label>
              <label className={styles.termsText} htmlFor="terms">
                I have read and accept the <button type="button" onClick={() => setLegalView('terms')}>User Agreement</button> and <button type="button" onClick={() => setLegalView('privacy')}>Privacy Policy</button>
              </label>
            </div>
          )}

          {!isCreate && (
            <label className={styles.fieldGroup}>
              <span className={styles.passwordLabelRow}>
                <span className={styles.label}>Password</span>
                {tab === 'login' && (
                  <button type="button" className={styles.forgotLink} onClick={() => { setView('forgot'); setError(''); }}>
                    Forgot?
                  </button>
                )}
              </span>
              <span className={styles.inputWrap}>
                <LockKey size={17} weight="bold" />
                <input
                  className={styles.field}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isCreate ? 'Create a strong password' : 'Enter your password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button type="button" className={styles.revealBtn} onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeSlash size={17} weight="bold" /> : <Eye size={17} weight="bold" />}
                </button>
              </span>
            </label>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button 
            className={styles.submitBtn} 
            type="submit" 
            disabled={busy || (isCreate && !acceptedTerms)}
          >
            {busy ? 'Please wait...' : isCreate ? 'Continue' : 'Login'}
          </button>
        </form>

        <button
          className={styles.googleBtn}
          type="button"
          onClick={submitGoogle}
          disabled={busy}
        >
          <GoogleIcon />
          <span>{busy ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>

        <div className={styles.divider}><span>or</span></div>

        <button className={styles.guestBtn} onClick={continueAsGuest}>
          Continue without an account
        </button>
      </div>
    </div>
  );
}
