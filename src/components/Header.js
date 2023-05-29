import React, {useState} from "react";
import styles from "./Header.module.css";
import {ReactComponent as Logo} from './upri-logo.svg';
import Button from "./Button";
import { SignInForm, SignUpForm } from "./Form";
import { Dashboard } from "./Dashboard";
import { ReactComponent as BurgerMenu } from './burger-menu-white.svg';
import { ReactComponent as CloseMenu } from './close-menu-white.svg';

function Header() {
  const [showSignInForm, setShowSignInForm] = useState(false);
  const [showSignUpForm, setShowSignUpForm] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [signupSuccessMessage, setSignupSuccessMessage] = useState('');

  const handleSignInClick = () => setShowSignInForm(true);
  const handleSignInClose = () => setShowSignInForm(false);
  const handleSignUpClick = () => setShowSignUpForm(true);
  const handleSignUpClose = () => setShowSignUpForm(false);

  const handleSignInSuccess = () => {
    setShowSignInForm(false);
    setShowDashboard(true);
    setIsLoggedIn(true); // User is now logged in
    setIsDashboardOpen(!isDashboardOpen);
    setShowDashboard(!isDashboardOpen)
  }
  const handleSignUpSuccess = () => {
    setSignupSuccessMessage("Registration Successful")
    setShowSignUpForm(false);
    setShowDashboard(true);
    setIsLoggedIn(true); // User is now logged in
    setIsDashboardOpen(!isDashboardOpen);
    setShowDashboard(!isDashboardOpen)
  }
  
  const handleDashboardToggle = () => {
    setIsDashboardOpen(!isDashboardOpen);
    setShowDashboard(!isDashboardOpen)
  };

  const handlePopupExit = () => {
    setSignupSuccessMessage('')
  };

  return(
    <div className={styles.header}>
    <div className={styles.headerContent}>
      <div className={styles.headerLeft}>
        <Logo className={styles.logo}/>
        <h1>CS•UPRI</h1>
      </div>
        <div className={styles.headerRight}>
          {isLoggedIn ? (
            <div className={styles.menuToggle} onClick={handleDashboardToggle}>
              {isDashboardOpen ? (
                <CloseMenu className={styles.closeMenu} />
              ) : (
                <BurgerMenu className={styles.burgerMenu} />
              )}
            </div>
          ) : (
            <>
              <Button hasOutline={false} onClick={handleSignInClick}>
                Sign in
              </Button>
              <Button hasOutline={true} onClick={handleSignUpClick}>
                Sign up
              </Button>
            </>
          )}
        </div>
    </div>
      {showSignInForm && <SignInForm onClick={handleSignInClose} onSuccess={handleSignInSuccess} />}
      {showSignUpForm && <SignUpForm onClick={handleSignUpClose} onSuccess={handleSignUpSuccess} />}
      {showDashboard && <Dashboard onClick={handleDashboardToggle} onEscapeClick={handleDashboardToggle} signupSuccessMessage={signupSuccessMessage} onPopupExit={handlePopupExit} />}
    </div>
  )
}

export default Header
