import React from "react";
import styles from "./ErrorPopup.module.css";

function ErrorPopup({ message }) {
  return (
    <div className={styles.errorPopup}>
      <p>{message}</p>
    </div>
  );
}

export default ErrorPopup;
