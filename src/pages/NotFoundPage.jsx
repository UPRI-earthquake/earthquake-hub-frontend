import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import NotFoundArt from '../assets/not-found-illustration.png';
import styles from './NotFoundPage.module.css';

const NotFoundPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Page Not Found | Earthquake Hub';
    }
  }, []);

  return (
    <div className={styles.page}>
      <Header variant="secure" showAccountControls={false} />
      <main className={styles.main} id="main">
        <p className={styles.heroTitle}>Page Not Found</p>
        <img
          src={NotFoundArt}
          alt="Broken UPRI globe with rubble and traffic cone"
          className={styles.art}
          loading="lazy"
        />
        <p className={styles.lede}>Oops! The link may be outdated or the page was moved.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryAction} onClick={() => navigate('/')}>
            Go to Home
          </button>
          <button type="button" className={styles.secondaryAction} onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </main>
    </div>
  );
};

export default NotFoundPage;
