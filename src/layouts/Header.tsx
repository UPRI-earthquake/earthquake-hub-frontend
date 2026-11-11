import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './styles/Header.module.css';
import UPRILogo from '../assets/upri-logo.svg?react';
import { AuthModal } from '@/shared/ui/components/Form';
import { Dashboard } from '../features/user-dashboard/ui/components/Dashboard';
import BurgerMenuIcon from '../assets/burger-menu-white.svg?react';
import ThemeToggle from '@/shared/ui/components/ThemeToggle';
import Toast, { ToastType } from '@/shared/ui/components/Toast';
import { useAuth } from '@/shared/services/account/context';
import AccountIcon from '@/shared/icons/AccountIcon';



/**
 * App header: brand, auth controls, and context actions.
 * Shows active station count on the Home page and provides sign-in/up and dashboard.
 */

interface HeaderProps {
  variant?: "default" | "secure";
  showAccountControls?: boolean;
  showThemeToggle?: boolean;
}

export default function Header({
  variant = 'default',
  showAccountControls = true,
  showThemeToggle = true,
}: HeaderProps) {
  // TODO: Determine number of stations for the active account
  const stationsCount = 0;

  const { isLoggedIn, profile, reload: reloadProfile } = useAuth();

  const {
    username: loggedInUser,
    email: accountEmail,
    rshakeEmailEnabled,
    passwordStatus,
    passwordPolicyVersion,
    derivedRole: loggedInUserRole
  } = profile || {};

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authView, setAuthView] = useState('signin');
  const [showDashboard, setShowDashboard] = useState(false);
  // Toasts
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('error');

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

  const handleSignInSuccess = (username, role, authMeta: any = {}) => {
    setShowAuthModal(false);
    setShowDashboard(true);
  };
  const handleSignUpSuccess = () => {
    setToastMessage('Registration Successful. You may now sign in.');
    setToastType('success');
    setShowAuthModal(false);
    setAuthView('signin');
    setShowDashboard(false);

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
  };

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
      const q = (typeof window !== 'undefined' && window["__toastQueue"]) || [];
      if (q.length) {
        const last = q[q.length - 1];
        window["__toastQueue"] = [];
        onToast({ detail: last });
      }
    } catch (_) {}
    return () => {
      window.removeEventListener('ui:toast', onToast);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div
      className={`${styles.header} ${isSecureFlow ? styles.secure : ''} ${
        showDashboard ? styles.dashboardOpen : ''
      }`}
    >
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
            <UPRILogo className={styles.logo} role="img" aria-label="UPRI logo" />
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
                <BurgerMenuIcon className={styles.burgerMenu} />
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
          rshakeEmailEnabled={rshakeEmailEnabled}
          passwordStatus={passwordStatus}
          passwordPolicyVersion={passwordPolicyVersion}
          onProfileRefresh={reloadProfile}
          onSignoutSuccess={handleSignoutSuccess}
          aria-label="User dashboard"
        />
      )}
    </div>
  );
}