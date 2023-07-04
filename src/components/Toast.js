import React from "react";
import styles from "./Toast.module.css";

function Toast(props) {
  const toastMessage = props.message;
  const toastType = props.toastType;

  return (
    <div className={styles.toastContainer}>
      {toastMessage.length > 0 && (
        <div className={`${styles.toast} ${toastType === 'error' ? styles.error : styles.success}`}>
          <p>{toastMessage}</p>
        </div>
      )}
    </div>
  )
}

export default Toast