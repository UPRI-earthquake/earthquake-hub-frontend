import React from "react";
import styles from "./Header.module.css";
import {ReactComponent as Logo} from './upri-logo.svg';

function Header() {
  // logo
  // upri

  return(
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <Logo className={styles.logo}/>
        <h1>UPRI</h1>
      </div>
    </div>
  )
}

export default Header
