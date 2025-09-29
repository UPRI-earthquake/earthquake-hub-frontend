import styles from "./Sidebar.module.css";

function Sidebar({ children }) {
  const first = Array.isArray(children) ? children[0] : children;
  const rest = Array.isArray(children) ? children.slice(1) : null;
  return (
    <div className={styles.sidebar}>
      <div className={styles.headerArea}>{first}</div>
      <div className={styles.itemsScroll}>{rest}</div>
    </div>
  );
}

export default Sidebar
