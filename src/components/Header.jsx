import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Header.module.css';
import { ReactComponent as Logo } from '../assets/upri-logo.svg';
import Button from './Button';
import FloatingButton from './FloatingButton';
import { SignInForm, SignUpForm } from './Form';
import { Dashboard } from './Dashboard';
import { ReactComponent as BurgerMenu } from '../assets/burger-menu-white.svg';
// import { ReactComponent as CloseMenu } from '../assets/close-menu-white.svg';
import ThemeToggle from './ThemeToggle';
import axios from 'axios';
import { backendHost } from '../utils/env';
import Toast from './Toast';
import { devwarn, deverror } from '../utils/devlog';

/**
 * App header: brand, auth controls, and context actions.
 * Shows active station count on the Home page and provides sign-in/up and dashboard.
 * @param {Object} props
 * @param {Array<Object>} [props.initStations] Optional initial stations to compute online count
 * @param {boolean} [props.showThemeToggle=true] Whether to render the theme toggle in the header
 */
const Header = ({ initStations = [], showThemeToggle = true }) => {
  const [stations] = useState(initStations);
  const stationsCount = stations.filter((station) => station.activity === 'active').length;

  const [loggedInUser, setLoggedInUser] = useState('');
  const [showSignInForm, setShowSignInForm] = useState(false);
  const [showSignUpForm, setShowSignUpForm] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [loggedInUserRole, setLoggedInUserRole] = useState();
  // Toasts
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  const location = useLocation(); // Get the current path
  const navigate = useNavigate(); // For navigation

  // Check if the current path is either /significant-eqs or /significant-eq-info
  const isSignificantEQPage =
    location.pathname === '/significant-eqs' || location.pathname === '/significant-eq-info';

  // Handle Home button click
  const handleHomeClick = () => {
    navigate('/'); // Navigate to the home page
  };

  const handleSignInClick = () => setShowSignInForm(true);
  const handleSignInClose = () => setShowSignInForm(false);
  const handleSignUpClick = () => setShowSignUpForm(true);
  const handleSignUpClose = () => setShowSignUpForm(false);

  const handleSignInSuccess = (username, role) => {
    setIsLoggedIn(true); // User is now logged in
    setLoggedInUser(username); // Pass the username of the logged in user
    setLoggedInUserRole(role); // This will be passed to the Dashboard Element
    setShowSignInForm(false);
    setShowDashboard(true);
  };
  const handleSignUpSuccess = () => {
    setToastMessage('Registration Successful. You may now sign in.');
    setToastType('success');
    setShowSignUpForm(false);
    setShowDashboard(false);
    setIsLoggedIn(false); // Don't automatically log the user

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
  };

  useEffect(() => {
    const accessTokenExistenceCheck = async () => {
      try {
        // Read API host from runtime env (no defaults; .env is expected to be configured)
        const backend_host = backendHost();
        axios.defaults.withCredentials = true;
        const response = await axios.get(`${backend_host}/accounts/profile`, {
          // Treat 401/403 as handled results instead of throwing errors (keeps console clean)
          validateStatus: (status) => status < 500,
        });
        if (response.status === 200) {
          setLoggedInUser(response.data.payload?.username || '');
          // /accounts/profile succeeds only for citizen cookie; set role accordingly
          setLoggedInUserRole('citizen');
          return response.data.payload?.email || '';
        }
        // Log non-200 auth checks in development for visibility
        devwarn('[auth] /accounts/profile check', {
          status: response.status,
          message: response.data?.message,
        });
        return null;
      } catch (error) {
        // Network/unexpected error — surface via dev logger
        deverror('[auth] /accounts/profile request error', error);
        return null;
      }
    };

    const checkAccessToken = async () => {
      const response = await accessTokenExistenceCheck();

      if (response) {
        setShowDashboard(false);
        setIsLoggedIn(true);
      }
    };

    checkAccessToken();
  }, []);

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
    <div className={styles.header}>
      {/* Skip to content (visible on keyboard focus) */}
      <a href="#main" className={styles.skipLink} aria-label="Skip to main content">
        Skip to content
      </a>
      <div className={styles.headerContent}>
        <div className={styles.headerLeft}>
          <Logo className={styles.logo} role="img" aria-label="UPRI logo" />
          <div className={styles.brandText}>
            <p className={styles.kicker}>Earthquake Hub</p>
            <h1 className={styles.title} title="Citizen Science • UPRI">
              CS•UPRI
            </h1>
          </div>
          {/* Temporarily hide header stations online indicator to avoid redundancy with sidebar */}
          {false && (
            <p>
              <i>Stations Online: </i>
              {stationsCount}
            </p>
          )}
        </div>
        <div className={styles.headerRight}>
          {showThemeToggle && <ThemeToggle size="compact" />}
          {isLoggedIn ? (
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
              {isSignificantEQPage ? (
                // Show Home button if on /significant-eqs or /significant-eq-info
                <Button
                  hasOutline={false}
                  onClick={handleHomeClick}
                  aria-label="Go to home"
                  title="Home"
                  data-size="compact"
                >
                  Home
                </Button>
              ) : (
                // Show Sign in and Sign up buttons for other pages
                <>
                  <Button
                    hasOutline={false}
                    onClick={handleSignInClick}
                    aria-label="Sign in"
                    title="Sign in"
                    data-size="compact"
                  >
                    Sign in
                  </Button>
                  <Button
                    hasOutline={true}
                    onClick={handleSignUpClick}
                    aria-label="Create an account"
                    title="Sign up"
                    data-size="compact"
                  >
                    Sign up
                  </Button>

                  {/* Show Floating Action Button (temporarily disabled by adding 'false' to avoid overlapping Legend control) */}
                  {false && !showSignInForm && !showSignUpForm && !showDashboard && (
                    <FloatingButton />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      <Toast
        message={toastMessage}
        toastType={toastType}
        onClose={() => setToastMessage('')}
      />
      {showSignInForm && <SignInForm onClick={handleSignInClose} onSuccess={handleSignInSuccess} />}
      {showSignUpForm && <SignUpForm onClick={handleSignUpClose} onSuccess={handleSignUpSuccess} />}
      {showDashboard && (
        <Dashboard
          onClick={handleDashboardToggle}
          onEscapeClick={handleDashboardToggle}
          loggedInUserRole={loggedInUserRole}
          loggedInUser={loggedInUser}
          onSignoutSuccess={handleSignoutSuccess}
          aria-label="User dashboard"
        />
      )}
    </div>
  );
};

export default Header;
