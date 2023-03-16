import React from "react";
import styles from "./ErrorScreen.module.css";
import {ReactComponent as Logo} from './upri-logo.svg';

function ErrorScreen() {
  return(
    <div className={styles.errorScreen}>
      <Logo className={styles.logo}/>
      <p className={styles.pg}>
        A server error occured. <br/>Please try again later.
      </p>
    </div>
  )
}

export default ErrorScreen
