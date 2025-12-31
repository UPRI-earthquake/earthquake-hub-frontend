import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { backendHost } from '../utils/env';
import Toast from './Toast';
import { devlog, deverror } from '../utils/devlog';
import { responseCodes } from '../utils/responseCodes';
import styles from './Form.module.css';
import InfoTooltip from './InfoTooltip';

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

function positionPopover(triggerRef, popRef, setPlacement, setStyle) {
  if (typeof window === 'undefined' || !triggerRef?.current || !popRef?.current) return;
  const triggerRect = triggerRef.current.getBoundingClientRect();
  const popoverRect = popRef.current.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spacing = 10;
  const margin = 12;
  const fits = {
    bottom: triggerRect.bottom + spacing + popoverRect.height <= viewportHeight - margin,
    top: triggerRect.top - spacing - popoverRect.height >= margin,
    right: triggerRect.right + spacing + popoverRect.width <= viewportWidth - margin,
    left: triggerRect.left - spacing - popoverRect.width >= margin,
  };
  const order = viewportWidth >= 720 ? ['bottom', 'right', 'left', 'top'] : ['bottom', 'top', 'right', 'left'];
  let placement = order.find((pos) => fits[pos]) || order[0];
  if (!fits[placement]) {
    const space = {
      bottom: viewportHeight - triggerRect.bottom - spacing - margin,
      top: triggerRect.top - spacing - margin,
      right: viewportWidth - triggerRect.right - spacing - margin,
      left: triggerRect.left - spacing - margin,
    };
    placement = Object.entries(space).sort((a, b) => b[1] - a[1])[0][0];
  }

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
  let top = triggerRect.bottom + spacing;
  let left = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;

  if (placement === 'top') {
    top = triggerRect.top - popoverRect.height - spacing;
    left = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;
  } else if (placement === 'right') {
    top = triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2;
    left = triggerRect.right + spacing;
  } else if (placement === 'left') {
    top = triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2;
    left = triggerRect.left - popoverRect.width - spacing;
  }

  top = clamp(top, margin, viewportHeight - popoverRect.height - margin);
  left = clamp(left, margin, viewportWidth - popoverRect.width - margin);

  const entry = {
    top: { x: 0, y: -4 },
    bottom: { x: 0, y: 4 },
    left: { x: -4, y: 0 },
    right: { x: 4, y: 0 },
  }[placement];

  setPlacement(placement);
  setStyle({
    top,
    left,
    '--popover-entry-x': `${entry?.x ?? 0}px`,
    '--popover-entry-y': `${entry?.y ?? 4}px`,
  });
}

function describeRegistrationPasswordIssue(password) {
  if (!password) return 'Password is required';
  if (password.length < 12) return 'Password must be at least 12 characters.';
  if (password.length > PASSWORD_MAX_LENGTH) return 'Password must be 128 characters or fewer.';
  const trimmed = password.trim();
  const lower = trimmed.toLowerCase();
  if (weakPasswords.includes(lower)) return 'Choose a less common password.';
  if (/^\d+$/.test(trimmed)) return 'Password cannot be numbers only.';
  if (/(.)\1{7,}/.test(trimmed)) return 'Avoid repeating the same character.';
  return '';
}

const AuthModal = ({ initialView = 'signin', onClose, onSignInSuccess, onSignUpSuccess }) => {
  const [activeView, setActiveView] = useState(initialView);
  const formRef = useRef(null);
  const infoRef = useRef(null);
  const popoverRef = useRef(null);
  const [showInfo, setShowInfo] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState('bottom');
  const [popoverStyle, setPopoverStyle] = useState({});
  const infoPopoverId = useMemo(() => `info-popover-${Math.random().toString(36).slice(2, 8)}`, []);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => {
    const formEl = formRef.current;
    if (!formEl) return;
    formEl.classList.remove(styles.hidden);
    formEl.animate(
      [
        { opacity: 0, transform: 'translateY(8px) scale(0.98)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      {
        duration: 160,
        easing: 'cubic-bezier(0, 0, 0.5, 1)',
      },
    );
    formEl.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showInfo && infoRef.current && !infoRef.current.contains(event.target)) {
        setShowInfo(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowInfo(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showInfo]);

  const updatePopoverPosition = useCallback(() => {
    positionPopover(infoRef, popoverRef, setPopoverPlacement, setPopoverStyle);
  }, []);

  useLayoutEffect(() => {
    if (showInfo) updatePopoverPosition();
  }, [showInfo, updatePopoverPosition]);

  useEffect(() => {
    if (!showInfo) return undefined;
    const handleAnyChange = () => {
      if (showInfo) updatePopoverPosition();
    };
    window.addEventListener('resize', handleAnyChange);
    window.addEventListener('scroll', handleAnyChange, true);
    return () => {
      window.removeEventListener('resize', handleAnyChange);
      window.removeEventListener('scroll', handleAnyChange, true);
    };
  }, [showInfo, updatePopoverPosition]);

  const handleTabChange = (next) => setActiveView(next);
  const tabSelection = activeView === 'recover' ? 'signin' : activeView;

  const content = (
    <div className={styles.modal} role="presentation" onClick={onClose}>
      <div
        ref={formRef}
        className={`${styles.form} ${styles.authShell} ${styles.hidden}`}
        role="dialog"
        aria-modal="true"
        aria-label="Contributor account"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className={styles.authHeader}>
          <div className={styles.authHeaderLeft}>
            <p className={styles.authKicker}>Contributor Access</p>
            <div className={styles.titleRow}>
              <h2 className={styles.authTitle}>UPRI Ehub Account</h2>
              <div className={styles.infoWrapper} ref={infoRef}>
                <button
                  type="button"
                className={styles.infoButton}
                aria-expanded={showInfo}
                aria-describedby={showInfo ? infoPopoverId : undefined}
                aria-label="Why accounts exist"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInfo((prev) => !prev);
                  }}
                >
                  <InfoIcon className={styles.infoIcon} />
                </button>
                {showInfo && (
                  <div
                    ref={popoverRef}
                    className={styles.infoPopover}
                    role="tooltip"
                    id={infoPopoverId}
                  data-placement={popoverPlacement}
                  style={popoverStyle}
                >
                  <p className={styles.infoTitle}>Not required for guests</p>
                    <p className={styles.infoCopy}>
                      Accounts are intended for citizen scientists and device owners who wish to contribute seismic data
                      and connect instruments to the UPRI Earthquake Network. Viewing the map and earthquake information
                      does not require an account.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button type="button" className={styles.dismiss} aria-label="Close account modal" onClick={onClose}>
            Close
          </button>
        </div>

        <div className={styles.tabList} role="tablist" aria-label="Account actions">
          <button
            type="button"
            role="tab"
            aria-selected={tabSelection === 'signin'}
            className={`${styles.tab} ${tabSelection === 'signin' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tabSelection === 'signup'}
            className={`${styles.tab} ${tabSelection === 'signup' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('signup')}
          >
            Register
          </button>
        </div>

        <div className={styles.intentBox}>
          <p className={styles.intentTitle}>For contributors only</p>
          <p className={styles.intentText}>
            Earthquake maps, alerts, and data are publicly accessible. An account is required only for contributors who
            connect devices or submit seismic data to the UPRI network.
          </p>
        </div>

        <div className={styles.authBody}>
          {activeView === 'signin' && (
            <SignInFields
              onSuccess={(username, role, authMeta) => onSignInSuccess(username, role, authMeta)}
              onForgotPassword={() => setActiveView('recover')}
            />
          )}
          {activeView === 'signup' && (
            <SignUpFields
              onSuccess={() => {
                onSignUpSuccess();
                setActiveView('signin');
              }}
            />
          )}
          {activeView === 'recover' && <RecoverPasswordFields onBack={() => setActiveView('signin')} />}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};

function SignInFields({ onSuccess, onForgotPassword }) {
  const backend_host = backendHost();

  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [selectedRole, setSelectedRole] = useState('citizen');
  const [errors, setErrors] = useState({});

  const handleForgotPassword = () => {
    if (typeof onForgotPassword === 'function') onForgotPassword();
  };

  const handleRoleChange = (event) => {
    setSelectedRole(event.target.value);
    setErrors((prev) => ({ ...prev, role: false }));
  };

  function validateClient(event) {
    const username = event.target.elements.username.value.trim();
    const password = event.target.elements.password.value || '';
    const role = event.target.elements.role.value;
    const nextErrors = {};
    if (!username) nextErrors.username = 'Username is required';
    if (!password) nextErrors.password = 'Password is required';
    if (!role) nextErrors.role = 'Role is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToastMessage(Object.values(nextErrors)[0]);
      setToastType('error');
      return null;
    }
    return { username, password, role };
  }

  async function handleSignInSubmit(event) {
    event.preventDefault();
    const username = event.target.elements.username.value;
    const password = event.target.elements.password.value;
    const role = event.target.elements.role.value;
    const valid = validateClient(event);
    if (!valid) return;
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backend_host}/accounts/authenticate`, {
        username: username,
        password: password,
        role: role,
      });

      if (response.data.status === responseCodes.AUTHENTICATION_TOKEN_COOKIE) {
        devlog('Sign in successful!');
        const authMeta = {
          passwordStatus: response.data.passwordStatus,
          passwordPolicyVersion: response.data.passwordPolicyVersion,
        };
        onSuccess(username, role, authMeta);
      } else {
        devlog('Something went wrong in submitting sign-in request');
      }
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        setToastMessage(data.message);
        setToastType('error');
        const m = String(data?.message || '').toLowerCase();
        const next = {};
        if (m.includes('role')) next.role = true;
        if (m.includes('password')) next.password = true;
        if (m.includes("doesn't exists") || m.includes('user') || m.includes('username')) next.username = true;
        setErrors(next);
        deverror('Error occurred while signing in:', data);
      } else {
        deverror('Error occurred while signing in:', error);
      }
    }
  }

  return (
    <form className={styles.authForm} onSubmit={handleSignInSubmit} noValidate>
      <label className={styles.fieldGroup} htmlFor="signin-username">
        Contributor username
        <input
          id="signin-username"
          type="text"
          name="username"
          autoComplete="username"
          placeholder="your-username"
          className={errors.username ? styles.inputError : ''}
          onChange={() => setErrors((prev) => ({ ...prev, username: false }))}
        />
      </label>
      <label className={styles.fieldGroup} htmlFor="signin-password">
        Password
        <input
          id="signin-password"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter password"
          className={errors.password ? styles.inputError : ''}
          onChange={() => setErrors((prev) => ({ ...prev, password: false }))}
        />
      </label>
      <label className={styles.fieldGroup} htmlFor="signin-role">
        Contributor role
        <span className={styles.fieldHint}>Choose how you participate in the network.</span>
        <select
          id="signin-role"
          name="role"
          value={selectedRole}
          onChange={handleRoleChange}
          className={errors.role ? styles.inputError : ''}
        >
          <option value="citizen">Citizen scientist</option>
          <option value="brgy">Barangay operator</option>
        </select>
      </label>
      <div className={styles.inlineActions}>
        <button
          type="button"
          className={styles.linkButton}
          onClick={handleForgotPassword}
          aria-label="Forgot password"
        >
          Forgot password?
        </button>
      </div>
      <div className={styles.formFooter}>
        <div className={styles.inlineToast}>
          <Toast message={toastMessage} toastType={toastType} placement="inline" />
        </div>
        <button type="submit">Sign in</button>
      </div>
    </form>
  );
}

function SignUpFields({ onSuccess }) {
  const backend_host = backendHost();

  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  const [selectedRole, setSelectedRole] = useState('citizen');
  const [errors, setErrors] = useState({});

  const handleRoleChange = (event) => {
    setSelectedRole(event.target.value);
    setErrors((prev) => ({ ...prev, role: false }));
  };

  function validateClient(event) {
    const role = event.target.elements.role.value;
    const email = (event.target.elements.email.value || '').trim();
    const username = (event.target.elements.username.value || '').trim();
    const password = event.target.elements.password.value || '';
    const confirmPassword = event.target.elements.confirmPassword.value || '';
    const nextErrors = {};
    if (!role) nextErrors.role = 'Role is required';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email address';
    if (!username) nextErrors.username = 'Username is required';
    const passwordIssue = describeRegistrationPasswordIssue(password);
    if (passwordIssue) nextErrors.password = passwordIssue;
    if (password && confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match';
    if (role === 'brgy') {
      const ringserverUrl = (event.target.elements.ringserverUrl.value || '').trim();
      const ringserverPort = (event.target.elements.ringserverPort.value || '').trim();
      if (!ringserverUrl) nextErrors.ringserverUrl = 'Ringserver URL is required';
      if (!/^[0-9]{1,5}$/.test(ringserverPort)) nextErrors.ringserverPort = 'Enter a valid port';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToastMessage(Object.values(nextErrors)[0]);
      setToastType('error');
      return null;
    }
    return true;
  }

  async function handleSignUpSubmit(event) {
    event.preventDefault();
    const role = event.target.elements.role.value;
    const email = event.target.elements.email.value;
    const username = event.target.elements.username.value;
    const password = event.target.elements.password.value;
    const confirmPassword = event.target.elements.confirmPassword.value;
    const ok = validateClient(event);
    if (!ok) return;
    try {
      let requestPayload = {
        role: role,
        email: email,
        username: username,
        password: password,
        confirmPassword: confirmPassword,
      };

      if (role === 'brgy') {
        const ringserverUrl = event.target.elements.ringserverUrl.value;
        const ringserverPort = event.target.elements.ringserverPort.value;
        requestPayload.ringserverUrl = ringserverUrl;
        requestPayload.ringserverPort = ringserverPort;
      }

      const response = await axios.post(`${backend_host}/accounts/register`, requestPayload);
      if (response.data.status === responseCodes.REGISTRATION_SUCCESS) {
        devlog('Sign up successful!');
        onSuccess();
      } else {
        devlog('Something went wrong in submitting sign-up request');
      }
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        setToastMessage(data.message);
        setToastType('error');
        const m = String(data?.message || '').toLowerCase();
        const next = {};
        if (m.includes('username')) next.username = true;
        if (m.includes('email')) next.email = true;
        if (m.includes('password')) next.password = true;
        setErrors(next);
        deverror('Error occurred while signing up:', data);
      } else {
        deverror('Error occurred while signing up:', error);
      }
    }
  }

  return (
    <form className={styles.authForm} onSubmit={handleSignUpSubmit} noValidate>
      <label className={styles.fieldGroup} htmlFor="signup-role">
        Contributor role
        <span className={styles.fieldHint}>Select how you contribute to the UPRI network.</span>
        <select
          id="signup-role"
          name="role"
          value={selectedRole}
          onChange={handleRoleChange}
          className={errors.role ? styles.inputError : ''}
        >
          <option value="citizen">Citizen scientist</option>
          <option value="brgy">Barangay operator</option>
        </select>
      </label>
      {selectedRole === 'brgy' && (
        <div className={styles.inlineFields}>
          <label className={styles.fieldGroup} htmlFor="signup-ringserver-url">
            Ringserver URL
            <span className={styles.fieldHint}>Host where your seismic stream is exposed.</span>
            <input
              id="signup-ringserver-url"
              type="text"
              name="ringserverUrl"
              autoComplete="url"
              placeholder="e.g. https://ringserver.example.com"
              className={errors.ringserverUrl ? styles.inputError : ''}
              onChange={() => setErrors((prev) => ({ ...prev, ringserverUrl: false }))}
            />
          </label>
          <label className={styles.fieldGroup} htmlFor="signup-ringserver-port">
            Ringserver port
            <span className={styles.fieldHint}>Port used by your device.</span>
            <input
              id="signup-ringserver-port"
              type="text"
              name="ringserverPort"
              inputMode="numeric"
              placeholder="16022"
              className={errors.ringserverPort ? styles.inputError : ''}
              onChange={() => setErrors((prev) => ({ ...prev, ringserverPort: false }))}
            />
          </label>
        </div>
      )}
      <label className={styles.fieldGroup} htmlFor="signup-email">
        Contact email
        <input
          id="signup-email"
          type="text"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          className={errors.email ? styles.inputError : ''}
          onChange={() => setErrors((prev) => ({ ...prev, email: false }))}
        />
      </label>
      <div className={styles.inlineFields}>
        <label className={styles.fieldGroup} htmlFor="signup-username">
          Username
          <input
            id="signup-username"
            type="text"
            name="username"
            autoComplete="username"
            placeholder="Create a username"
            className={errors.username ? styles.inputError : ''}
            onChange={() => setErrors((prev) => ({ ...prev, username: false }))}
          />
        </label>
        <label className={styles.fieldGroup} htmlFor="signup-password">
          <span className={styles.fieldLabelRow}>
            Password
            <InfoTooltip label="Password requirements" title="Password requirements" variant="inline">
              Minimum 12 characters. Letters, numbers, and special characters.
            </InfoTooltip>
          </span>
          <input
            id="signup-password"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Enter password"
            className={errors.password ? styles.inputError : ''}
            onChange={() => setErrors((prev) => ({ ...prev, password: false }))}
          />
        </label>
      </div>
      <label className={styles.fieldGroup} htmlFor="signup-password-confirm">
        Confirm password
        <input
          id="signup-password-confirm"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter password"
          className={errors.confirmPassword ? styles.inputError : ''}
          onChange={() => setErrors((prev) => ({ ...prev, confirmPassword: false }))}
        />
      </label>
      <div className={styles.formFooter}>
        <div className={styles.inlineToast}>
          <Toast message={toastMessage} toastType={toastType} placement="inline" />
        </div>
        <button type="submit">Create account</button>
      </div>
    </form>
  );
}

function RecoverPasswordFields({ onBack }) {
  const backend_host = backendHost();
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState(false);

  const handleBack = () => {
    if (typeof onBack === 'function') onBack();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const email = (event.target.elements.email.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(true);
      setToastMessage('Enter a valid email address.');
      setToastType('error');
      return;
    }
    setEmailError(false);
    setIsSubmitting(true);
    try {
      axios.defaults.withCredentials = true;
      await axios.post(`${backend_host}/accounts/forgot-password`, { email });
      setToastMessage(
        'If this email is registered, we sent a verification link or code to reset your password.',
      );
      setToastType('success');
    } catch (error) {
      deverror('Error occurred while requesting password reset:', error?.response || error);
      setToastMessage('We could not process the reset right now. Please try again in a few minutes.');
      setToastType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.authForm} onSubmit={handleSubmit} noValidate>
      <p className={styles.intentTitle}>Reset your password</p>
      <p className={styles.intentText}>
        Enter the email linked to your contributor account. We will email a verification link or
        code if an account exists.
      </p>
      <label className={styles.fieldGroup} htmlFor="recover-email">
        Registered email
        <input
          id="recover-email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          className={emailError ? styles.inputError : ''}
          onChange={() => setEmailError(false)}
        />
      </label>
      <div className={styles.mutedBox}>
        <p className={styles.fieldHint}>
          For security, we never confirm whether an email exists in the system.
        </p>
        <ol className={styles.resetSteps}>
          <li>Check your email for a verification link or code.</li>
          <li>Follow the link to confirm your identity.</li>
          <li>Create a new password to complete the reset.</li>
        </ol>
      </div>
      <div className={styles.formFooter}>
        <div className={styles.inlineToast}>
          <Toast message={toastMessage} toastType={toastType} placement="inline" />
        </div>
        <div className={styles.recoverActions}>
          <button type="button" className={styles.linkButton} onClick={handleBack}>
            Back to sign in
          </button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </div>
      </div>
    </form>
  );
}

function InfoIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v6" />
      <circle cx="12" cy="7.25" r="0.85" fill="currentColor" />
    </svg>
  );
}

export { AuthModal };
