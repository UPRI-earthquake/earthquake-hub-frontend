import React, { useState, useEffect } from "react";
import styles from "./Header.module.css";
import {ReactComponent as Logo} from './upri-logo.svg';
import Button from "./Button";
import { SignInForm, SignUpForm } from "./Form";
import { Dashboard } from "./Dashboard";
import { ReactComponent as BurgerMenu } from './burger-menu-white.svg';
import { ReactComponent as CloseMenu } from './close-menu-white.svg';
import axios from 'axios';

function Header() {
  const [loggedInUser, setLoggedInUser] = useState('');
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

  const handleSignInSuccess = (username) => {
    setLoggedInUser(username); // Pass the username of the logged in user
    setShowSignInForm(false);
    setShowDashboard(true);
    setIsLoggedIn(true); // User is now logged in
    setIsDashboardOpen(!isDashboardOpen);
    setShowDashboard(!isDashboardOpen)
  }
  const handleSignUpSuccess = (username) => {
    setLoggedInUser(username); // Pass the username of the logged in user
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

  const handleSignoutSuccess = () => {
    setShowDashboard(false);
    setIsLoggedIn(false);
    setIsDashboardOpen(!isDashboardOpen);
    setShowDashboard(!isDashboardOpen)
  }

  useEffect(() => {
    const accessTokenExistenceCheck = async () => {
      try {
        const backend_host = process.env.NODE_ENV === 'production'
          ? window['ENV'].REACT_APP_BACKEND
          : window['ENV'].REACT_APP_BACKEND_DEV;
        axios.defaults.withCredentials = true;
        const response = await axios.get(`${backend_host}/accounts/profile`);
        setLoggedInUser(response.data.payload.username)
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
        setIsDashboardOpen(false);
      }
    };
  
    checkAccessToken();
  }, []);
  

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
      {showDashboard && 
        <Dashboard 
          onClick={handleDashboardToggle} 
          onEscapeClick={handleDashboardToggle} 
          signupSuccessMessage={signupSuccessMessage}
          loggedInUser={loggedInUser}
          onSignoutSuccess={handleSignoutSuccess} />}
    </div>
  )
}

export default Header
