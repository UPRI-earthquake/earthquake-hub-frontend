import React from "react";
import styles from "./ErrorScreen.module.css";
import {ReactComponent as Logo} from './upri-logo.svg';

function ErrorScreen() {
  return(
    <div className={styles.errorScreen}>
      <Logo className={styles.logo}/>
      <p>
        A server error occured. Please try again later.
      </p>
    </div>
  )
}

export default ErrorScreen
