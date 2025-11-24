import { useNavigate } from 'react-router-dom';
import styles from './FloatingButton.module.css';

/**
 * Floating action button linking to Significant Earthquakes list.
 */
function FloatingButton() {
  const navigate = useNavigate();

  const handleFabClick = () => {
    navigate('/significant-eqs');
  };

  return (
    <div className={styles.floatingButton}>
      <span className={styles.fabText} onClick={handleFabClick}>
        Significant Earthquakes
      </span>
    </div>
  );
}

export default FloatingButton;
