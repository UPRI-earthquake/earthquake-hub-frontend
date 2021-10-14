import React from "react";
import styles from "./LoadingScreen.module.css";
import "./upri-logo-animation.css";
import {ReactComponent as Logo} from './upri-logo-loading.svg';

function LoadingScreen() {
  return(
    <div className={styles.loadingScreen}>
      <Logo className={styles.logo}/>
      <p className={styles.pg}>
        &nbsp;
      </p>
    </div>
  )
}

export default LoadingScreen
