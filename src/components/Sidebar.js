import React from "react"
import styles from "./Sidebar.module.css"

function Sidebar(props) {
  return (
    <div className={styles.sidebar}>
      {props.children}
    </div>
  )
}

export default Sidebar
