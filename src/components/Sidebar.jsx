import styles from './Sidebar.module.css';

/**
 * Sidebar two‑pane layout where the first child is the header and the rest scroll.
 * @param {{children: React.ReactNode}} props
 */
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

export default Sidebar;
