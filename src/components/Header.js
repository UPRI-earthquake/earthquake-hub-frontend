import React, {useState} from "react";
import styles from "./Header.module.css";
import {ReactComponent as Logo} from './upri-logo.svg';
import Button from "./Button";
import { SignInForm, SignUpForm } from "./Form";

function Header() {
  const [showSignInForm, setShowSignInForm] = useState(false);
  const [showSignUpForm, setShowSignUpForm] = useState(false);

  const handleSignInClick = () => setShowSignInForm(true);
  const handleSignInClose = () => setShowSignInForm(false);
  const handleSignUpClick = () => setShowSignUpForm(true);
  const handleSignUpClose = () => setShowSignUpForm(false);

  return(
    <div className={styles.header}>
    <div className={styles.headerContent}>
      <div className={styles.headerLeft}>
        <Logo className={styles.logo}/>
        <h1>CS•UPRI</h1>
      </div>
      <div className={styles.headerRight}>
        <Button hasOutline={false} onClick={handleSignInClick}>
          Sign in
        </Button>
        <Button hasOutline={true} onClick={handleSignUpClick}>
          Sign up
        </Button>
      </div>
    </div>
      {showSignInForm && <SignInForm onClick={handleSignInClose} />}
      {showSignUpForm && <SignUpForm onClick={handleSignUpClose} />}
    </div>
  )
}

export default Header
