import React from "react";
import styles from "./SidebarItem.module.css"

function SidebarItem({title, description, subDescription}) {
  return(
    <div className={styles.sidebarItem}>
      <h4>{title}</h4>
      <div>
        <p className={styles.desc}>{description}</p>
        <p className={styles.subDesc}>{subDescription}</p>
      </div>

    </div>
  )
}

export default SidebarItem
