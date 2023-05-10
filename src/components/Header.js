import React from "react";
import styles from "./Header.module.css";
import {ReactComponent as Logo} from './upri-logo.svg';
import Button from "./Button";

function Header() {
  // logo
  // upri

  return(
    <div className={styles.header}>
    <div className={styles.headerContent}>
      <div className={styles.headerLeft}>
        <Logo className={styles.logo}/>
        <h1>CS•UPRI</h1>
      </div>
      <div className={styles.headerRight}>
        <Button
          hasOutline={false}
          onClick={() => console.log("Sign in clicked!")}
        >
          Sign in
        </Button>
        <Button
          hasOutline={true}
          onClick={() => console.log("Sign up clicked!")}
        >
          Sign up
        </Button>
      </div>
    </div>
    </div>
  )
}

export default Header
