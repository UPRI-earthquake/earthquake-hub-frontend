import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Header.module.css';
import { ReactComponent as Logo } from '../assets/upri-logo.svg';
import { AuthModal } from './Form';
import { Dashboard } from './Dashboard';
import { ReactComponent as BurgerMenu } from '../assets/burger-menu-white.svg';
// import { ReactComponent as CloseMenu } from '../assets/close-menu-white.svg';
import ThemeToggle from './ThemeToggle';
import axios from 'axios';
import { backendHost } from '../utils/env';
import Toast from './Toast';
import { devwarn, deverror } from '../utils/devlog';

function AccountIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 12.25c2.347 0 4.25-1.903 4.25-4.25S14.347 3.75 12 3.75 7.75 5.653 7.75 8s1.903 4.25 4.25 4.25Z" />
      <path d="M18.25 20.25v-1a2.25 2.25 0 0 0-2.25-2.25h-8a2.25 2.25 0 0 0-2.25 2.25v1" />
      <circle cx="12" cy="12" r="9.25" />
    </svg>
  );
}

/**
 * App header: brand, auth controls, and context actions.
 * Shows active station count on the Home page and provides sign-in/up and dashboard.
 * @param {Object} props
 * @param {Array<Object>} [props.initStations] Optional initial stations to compute online count
 * @param {'default' | 'secure'} [props.variant] Header visual mode
 * @param {boolean} [props.showAccountControls] Whether to render auth/dashboard controls
 * @param {boolean} [props.showThemeToggle] Whether to show theme toggle
 */
const Header = ({
  initStations = [],
  variant = 'default',
  showAccountControls = true,
  showThemeToggle = true,
}) => {
  const [stations] = useState(initStations);
  const stationsCount = stations.filter((station) => station.activity === 'active').length;

  const [loggedInUser, setLoggedInUser] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [passwordStatus, setPasswordStatus] = useState();
  const [passwordPolicyVersion, setPasswordPolicyVersion] = useState();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authView, setAuthView] = useState('signin');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [loggedInUserRole, setLoggedInUserRole] = useState();
  // Toasts
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  const navigate = useNavigate(); // For navigation
  const isSecureFlow = variant === 'secure' || showAccountControls === false;
  const themeEnabled = showThemeToggle !== false;

  // Handle Home button click
  const handleHomeClick = () => navigate('/');

  const openAuthModal = (view = 'signin') => {
    setAuthView(view);
    setShowAuthModal(true);
  };
  const handleAuthClose = () => setShowAuthModal(false);

  const handleSignInSuccess = (username, role, authMeta = {}) => {
    setIsLoggedIn(true); // User is now logged in
    setLoggedInUser(username); // Pass the username of the logged in user
    setLoggedInUserRole(role); // This will be passed to the Dashboard Element
    setAccountEmail(authMeta.email || '');
    setPasswordStatus(authMeta.passwordStatus);
    setPasswordPolicyVersion(authMeta.passwordPolicyVersion);
    setShowAuthModal(false);
    setShowDashboard(true);
  };
  const handleSignUpSuccess = () => {
    setToastMessage('Registration Successful. You may now sign in.');
    setToastType('success');
    setShowAuthModal(false);
    setAuthView('signin');
    setShowDashboard(false);
    setIsLoggedIn(false); // Don't automatically log the user
    setLoggedInUser('');
    setAccountEmail('');
    setPasswordStatus(undefined);
    setPasswordPolicyVersion(undefined);
    setLoggedInUserRole(undefined);

    // remove toast after timeout
    setTimeout(() => {
      setToastMessage('');
    }, 1000 * 6);
  };

  const handleDashboardToggle = () => {
    setShowDashboard(!showDashboard);
  };

  const handleSignoutSuccess = () => {
    setShowDashboard(false);
    setIsLoggedIn(false);
    setLoggedInUser('');
    setAccountEmail('');
    setPasswordStatus(undefined);
    setPasswordPolicyVersion(undefined);
    setLoggedInUserRole(undefined);
  };

  useEffect(() => {
    axios.defaults.withCredentials = true;
  }, []);

  const applySessionFromProfile = useCallback((payload = {}) => {
    const derivedRole = (payload.roles || []).includes('brgy') ? 'brgy' : 'citizen';
    setLoggedInUser(payload.username || '');
    setAccountEmail(payload.email || '');
    const nextPasswordStatus =
      payload.passwordStatus ||
      ((payload.passwordPolicyVersion || 0) >= 2 ? 'current' : undefined);
    setPasswordStatus(nextPasswordStatus);
    setPasswordPolicyVersion(payload.passwordPolicyVersion);
    setLoggedInUserRole(derivedRole);
    setIsLoggedIn(true);
  }, []);

  const handleSessionExpiry = useCallback(() => {
    setShowDashboard(false);
    setIsLoggedIn(false);
    setLoggedInUser('');
    setAccountEmail('');
    setPasswordStatus(undefined);
    setPasswordPolicyVersion(undefined);
    setLoggedInUserRole(undefined);
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      // Read API host from runtime env (no defaults; .env is expected to be configured)
      const backend_host = backendHost();
      const response = await axios.get(`${backend_host}/accounts/profile`, {
        // Treat 401/403 as handled results instead of throwing errors (keeps console clean)
        validateStatus: (status) => status < 500,
      });
      if (response.status === 200 && response.data?.payload?.username) {
        applySessionFromProfile(response.data.payload);
        return { ok: true, status: response.status, payload: response.data.payload };
      }
      if (response.status === 401 || response.status === 403) {
        handleSessionExpiry();
        return { ok: false, status: response.status };
      }
      // Log non-200 auth checks in development for visibility
      devwarn('[auth] /accounts/profile check', {
        status: response.status,
        message: response.data?.message,
      });
      return { ok: false, status: response.status };
    } catch (error) {
      // Network/unexpected error — surface via dev logger
      deverror('[auth] /accounts/profile request error', error);
      return { ok: false, error: true };
    }
  }, [applySessionFromProfile, handleSessionExpiry]);

  useEffect(() => {
    if (isSecureFlow) return undefined;
    fetchProfile();
    return undefined;
  }, [fetchProfile, isSecureFlow]);

  useEffect(() => {
    const onAuth = (ev) => {
      const { view = 'signin' } = (ev && ev.detail) || {};
      setAuthView(view);
      setShowAuthModal(true);
    };
    window.addEventListener('ui:auth', onAuth);
    try {
      const queue = (typeof window !== 'undefined' && window.__authQueue) || [];
      if (queue.length) {
        const last = queue[queue.length - 1];
        window.__authQueue = [];
        onAuth({ detail: last });
      }
    } catch (_) {}
    return () => {
      window.removeEventListener('ui:auth', onAuth);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn || isSecureFlow) return undefined;
    fetchProfile();
    const sessionPoll = setInterval(() => {
      fetchProfile();
    }, 5 * 60 * 1000);

    return () => clearInterval(sessionPoll);
  }, [fetchProfile, isLoggedIn, isSecureFlow]);

  useEffect(() => {
    if (isSecureFlow) {
      setShowDashboard(false);
    }
  }, [isSecureFlow]);

  // Global toast bridge: react to UI events dispatched by services (e.g., push subscription)
  useEffect(() => {
    let hideTimer = null;
    const onToast = (ev) => {
      const { message = '', type = 'error' } = (ev && ev.detail) || {};
      if (!message) return;
      setToastMessage(message);
      setToastType(type);
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setToastMessage(''), 6000);
    };
    window.addEventListener('ui:toast', onToast);
    // Flush any queued toasts that may have fired before Header mounted
    try {
      const q = (typeof window !== 'undefined' && window.__toastQueue) || [];
      if (q.length) {
        const last = q[q.length - 1];
        window.__toastQueue = [];
        onToast({ detail: last });
      }
    } catch (_) {}
    return () => {
      window.removeEventListener('ui:toast', onToast);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div className={`${styles.header} ${isSecureFlow ? styles.secure : ''}`}>
      {/* Skip to content (visible on keyboard focus) */}
      <a href="#main" className={styles.skipLink} aria-label="Skip to main content">
        Skip to content
      </a>
      <div className={`${styles.headerContent} ${isSecureFlow ? styles.secureContent : ''}`}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.brandButton}
            aria-label="Go to Earthquake Hub home"
            onClick={handleHomeClick}
          >
            <Logo className={styles.logo} role="img" aria-label="UPRI logo" />
            <div className={styles.brandText}>
              <p className={styles.kicker}>Earthquake Hub</p>
              <h1 className={styles.title} title="Citizen Science • UPRI">
                CS•UPRI
              </h1>
            </div>
          </button>
          {/* Temporarily hide header stations online indicator to avoid redundancy with sidebar */}
          {false && (
            <p>
              <i>Stations Online: </i>
              {stationsCount}
            </p>
          )}
      </div>
        <div className={styles.headerRight}>
          {themeEnabled && <ThemeToggle size="compact" />}
          {!isSecureFlow && showAccountControls && (
            isLoggedIn ? (
              <div
                className={styles.menuToggle}
                onClick={handleDashboardToggle}
                role="button"
                tabIndex={0}
                aria-label={showDashboard ? 'Toggle dashboard' : 'Toggle dashboard'}
                aria-expanded={showDashboard}
                aria-controls="dashboard-panel"
                title="Dashboard"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleDashboardToggle();
                }}
              >
                {/* Keep burger icon even when dashboard is open; rely on in-panel × to close */}
                <BurgerMenu className={styles.burgerMenu} />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.accountEntry}
                  aria-label="Contributor account"
                  title="Contributor account"
                  onClick={() => openAuthModal('signin')}
                >
                  <AccountIcon className={styles.accountIcon} />
                  <span className={styles.accountLabel}>Account</span>
                </button>
              </>
            )
          )}
        </div>
      </div>
      <Toast
        message={toastMessage}
        toastType={toastType}
        onClose={() => setToastMessage('')}
      />
      {!isSecureFlow && showAuthModal && (
        <AuthModal
          initialView={authView}
          onClose={handleAuthClose}
          onSignInSuccess={handleSignInSuccess}
          onSignUpSuccess={handleSignUpSuccess}
        />
      )}
      {!isSecureFlow && showDashboard && (
        <Dashboard
          onClick={handleDashboardToggle}
          onEscapeClick={handleDashboardToggle}
          loggedInUserRole={loggedInUserRole}
          loggedInUser={loggedInUser}
          accountEmail={accountEmail}
          passwordStatus={passwordStatus}
          passwordPolicyVersion={passwordPolicyVersion}
          onProfileRefresh={fetchProfile}
          onSignoutSuccess={handleSignoutSuccess}
          aria-label="User dashboard"
        />
      )}
    </div>
  );
};

export default Header;
