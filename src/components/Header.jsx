import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Header.module.css';
import { ReactComponent as Logo } from './upri-logo.svg';
import Button from './Button';
import FloatingButton from './FloatingButton';
import { SignInForm, SignUpForm } from './Form';
import { Dashboard } from './Dashboard';
import { ReactComponent as BurgerMenu } from './burger-menu-white.svg';
import { ReactComponent as CloseMenu } from './close-menu-white.svg';
import axios from 'axios';
import Toast from './Toast';

/**
 * App header: brand, auth controls, and context actions.
 * Shows active station count on the Home page and provides sign-in/up and dashboard.
 * @param {Object} props
 * @param {Array<Object>} [props.initStations] Optional initial stations to compute online count
 */
const Header = ({ initStations = [] }) => {
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
        const backend_host =
          process.env.NODE_ENV === 'production'
            ? window['ENV'].REACT_APP_BACKEND
            : window['ENV'].REACT_APP_BACKEND_DEV;
        axios.defaults.withCredentials = true;
        const response = await axios.get(`${backend_host}/accounts/profile`);
        setLoggedInUser(response.data.payload.username);
        return response.data.payload.email;
      } catch (error) {
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

  return (
    <div className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.headerLeft}>
          <Logo className={styles.logo} role="img" aria-label="UPRI logo" />
          <h1>CS•UPRI</h1>
          {/* Temporarily hide header stations online indicator to avoid redundancy with sidebar */}
          {false && (
            <p>
              <i>Stations Online: </i>
              {stationsCount}
            </p>
          )}
        </div>
        <div className={styles.headerRight}>
          {isLoggedIn ? (
            <div
              className={styles.menuToggle}
              onClick={handleDashboardToggle}
              role="button"
              tabIndex={0}
              aria-label="Toggle dashboard"
              aria-expanded={showDashboard}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleDashboardToggle();
              }}
            >
              {showDashboard ? (
                <CloseMenu className={styles.closeMenu} />
              ) : (
                <BurgerMenu className={styles.burgerMenu} />
              )}
            </div>
          ) : (
            <>
              {isSignificantEQPage ? (
                // Show Home button if on /significant-eqs or /significant-eq-info
                <Button hasOutline={false} onClick={handleHomeClick}>
                  Home
                </Button>
              ) : (
                // Show Sign in and Sign up buttons for other pages
                <>
                  <Button hasOutline={false} onClick={handleSignInClick}>
                    Sign in
                  </Button>
                  <Button hasOutline={true} onClick={handleSignUpClick}>
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
      <Toast message={toastMessage} toastType={toastType}></Toast>
      {showSignInForm && <SignInForm onClick={handleSignInClose} onSuccess={handleSignInSuccess} />}
      {showSignUpForm && <SignUpForm onClick={handleSignUpClose} onSuccess={handleSignUpSuccess} />}
      {showDashboard && (
        <Dashboard
          onClick={handleDashboardToggle}
          onEscapeClick={handleDashboardToggle}
          loggedInUserRole={loggedInUserRole}
          loggedInUser={loggedInUser}
          onSignoutSuccess={handleSignoutSuccess}
        />
      )}
    </div>
  );
};

export default Header;
