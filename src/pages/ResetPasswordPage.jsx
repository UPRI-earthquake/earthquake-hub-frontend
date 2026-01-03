import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Toast from '../components/Toast';
import PasswordInput from '../components/PasswordInput';
import { backendHost } from '../utils/env';
import { responseCodes } from '../utils/responseCodes';
import styles from './ResetPasswordPage.module.css';

const weakPasswords = [
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'qwerty',
  'letmein',
  'welcome',
  'earthquake',
  'upri',
  'citizen',
  'brgy',
];
const PASSWORD_MAX_LENGTH = 128;
const RESET_LINK_EXPIRY_MINUTES = 30;

function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = String(email).split('@');
  if (!domain) return '';
  const first = local.slice(0, 1) || '•';
  const hidden = '•'.repeat(Math.max(local.length - 1, 3));
  return `${first}${hidden}@${domain}`;
}

function extractEmailFromToken(token) {
  if (!token) return '';
  try {
    const [, payload] = token.split('.');
    if (!payload || typeof atob !== 'function') return '';
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.email === 'string' ? decoded.email : '';
  } catch (_) {
    return '';
  }
}

function describePasswordIssue(password) {
  if (!password) return 'Password is required.';
  if (password.length < 12) return 'Password must be at least 12 characters.';
  if (password.length > PASSWORD_MAX_LENGTH) return 'Password must be 128 characters or fewer.';
  const trimmed = password.trim();
  const lower = trimmed.toLowerCase();
  if (weakPasswords.includes(lower)) return 'Choose a less common password.';
  if (/^\d+$/.test(trimmed)) return 'Password cannot be numbers only.';
  if (/(.)\1{7,}/.test(trimmed)) return 'Avoid repeating the same character.';
  return '';
}

function queueToast(detail) {
  if (typeof window === 'undefined') return;
  const queue = window.__toastQueue || [];
  queue.push(detail);
  window.__toastQueue = queue;
  window.dispatchEvent(new CustomEvent('ui:toast', { detail }));
}

function queueAuth(view = 'signin') {
  if (typeof window === 'undefined') return;
  const queue = window.__authQueue || [];
  queue.push({ view });
  window.__authQueue = queue;
  window.dispatchEvent(new CustomEvent('ui:auth', { detail: { view } }));
}

const ResetPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
  const resetEmail = useMemo(() => extractEmailFromToken(token), [token]);
  const maskedEmail = useMemo(() => maskEmail(resetEmail), [resetEmail]);
  const accountLine = maskedEmail
    ? `Resetting password for ${maskedEmail}`
    : 'Resetting password for your account';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [tokenError, setTokenError] = useState(token ? '' : 'Reset link is missing or invalid.');
  const [toastMessage, setToastMessage] = useState(
    token ? 'Enter a new password to complete your reset.' : 'Resend your reset link to continue.'
  );
  const [toastType, setToastType] = useState(token ? 'info' : 'error');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.defaults.withCredentials = true;
  }, []);

  const handleRequestNewLink = () => {
    queueAuth('recover');
    queueToast({
      message: 'Enter your contributor email to resend your reset link.',
      type: 'info',
    });
    navigate('/', { replace: false });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      setTokenError('Reset link is missing or invalid.');
      setToastMessage('Reset link is missing or invalid.');
      setToastType('error');
      return;
    }

    const issue = describePasswordIssue(password);
    if (issue) {
      setPasswordError(issue);
      setToastMessage(issue);
      setToastType('error');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords should match.');
      setToastMessage('Passwords should match.');
      setToastType('error');
      return;
    }

    setSubmitting(true);
    setPasswordError('');
    setTokenError('');
    try {
      const apiHost = backendHost();
      const response = await axios.post(`${apiHost}/accounts/reset-password`, {
        token,
        password,
        confirmPassword,
      });

      if (response?.status === 200) {
        const successDetail = {
          message: 'Password updated. Please sign in with your new password.',
          type: 'success',
        };
        setToastMessage(successDetail.message);
        setToastType('success');
        queueToast(successDetail);
        queueAuth('signin');
        setTimeout(() => navigate('/', { replace: true }), 900);
        return;
      }

      throw new Error('Unexpected response while resetting password.');
    } catch (error) {
      const statusCode = error?.response?.data?.status;
      const message =
        error?.response?.data?.message ||
        'We could not reset your password right now. Please try again in a few minutes.';
      setToastMessage(message);
      setToastType('error');
      if (statusCode === responseCodes.PASSWORD_RESET_EXPIRED) {
        setTokenError('This reset link has expired. Resend a reset link to continue.');
      } else if (statusCode === responseCodes.PASSWORD_RESET_INVALID) {
        setTokenError('This reset link is invalid. Resend a reset link to continue.');
      } else if (statusCode === responseCodes.PASSWORD_RESET_USER_MISSING) {
        setTokenError('We could not find an account for this link. Resend a reset link to continue.');
      } else if (statusCode === responseCodes.VALIDATION_ERROR) {
        setPasswordError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Header variant="secure" showAccountControls={false} />
      <main className={styles.main} id="main">
        <section className={styles.card} aria-labelledby="reset-title">
          <p className={styles.kicker}>Password reset</p>
          <div className={styles.headingRow}>
            <h1 className={styles.title} id="reset-title">
              Choose a new password
            </h1>
            <span className={styles.badge}>Secure access</span>
          </div>
          <p className={styles.accountLine} aria-live="polite">
            {accountLine}
          </p>
          <p className={styles.lede}>
            Follow the link we sent to your email to confirm your identity. Your new password should
            be strong and unique to keep your account secure.
          </p>
          {tokenError && (
            <div className={styles.inlineAlert} role="alert">
              <div className={styles.alertTitle}>Reset link issue</div>
              <p className={styles.alertBody}>{tokenError}</p>
              <button type="button" className={styles.ghostButton} onClick={handleRequestNewLink}>
                Resend reset link
              </button>
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <label className={styles.fieldGroup} htmlFor="new-password">
              New password
              <PasswordInput
                id="new-password"
                name="password"
                autoComplete="new-password"
                inputClassName={passwordError ? styles.inputError : ''}
                hasError={!!passwordError}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
                minLength={12}
                maxLength={PASSWORD_MAX_LENGTH}
                required
              />
              <span className={styles.hint}>Minimum 12 characters. Avoid common phrases or repeats.</span>
            </label>

            <label className={styles.fieldGroup} htmlFor="confirm-password">
              Confirm new password
              <PasswordInput
                id="confirm-password"
                name="confirmPassword"
                autoComplete="new-password"
                inputClassName={passwordError ? styles.inputError : ''}
                hasError={!!passwordError}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError('');
                }}
                required
              />
            </label>

            <div className={styles.formFooter}>
              <div className={styles.inlineToast}>
                <Toast message={toastMessage} toastType={toastType} placement="inline" />
              </div>
              <div className={styles.actions}>
                <span className={styles.expiryNote}>
                  This link expires in about {RESET_LINK_EXPIRY_MINUTES} minutes.
                </span>
                <button type="button" className={styles.linkButton} onClick={handleRequestNewLink}>
                  Resend reset link
                </button>
                <button type="submit" disabled={submitting || !token}>
                  {submitting ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
