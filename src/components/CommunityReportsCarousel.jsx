import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './CommunityReportsCarousel.module.css';
import { getBackendHost } from '../utils/backendHost';

const CAROUSEL_ROTATION_INTERVAL_MS = 6000;
const MAX_PREVIEW_REPORTS = 5;

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

/**
 * Resolve relative image URLs from the API to absolute URLs
 * @param {string} imageUrl - Raw image URL from API
 * @returns {string} - Resolved absolute URL or empty string
 */
function resolveImageUrl(imageUrl) {
  if (typeof imageUrl !== 'string') return '';
  const trimmedUrl = imageUrl.trim();
  if (!trimmedUrl) return '';

  const isSafeDataImageUrl = (url) => /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(url);
  const isSafeHttpUrl = (url) => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };
  const isSafeProtocolRelativeUrl = (url) => /^\/\//.test(url);
  if (isSafeDataImageUrl(trimmedUrl) || isSafeHttpUrl(trimmedUrl) || isSafeProtocolRelativeUrl(trimmedUrl)) {
    return trimmedUrl;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmedUrl)) return '';
  const apiHost = getBackendHost();
  if (!apiHost) return '';

  try {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const backendUrl = new URL(apiHost, fallbackOrigin);
    const resolvedUrl = new URL(trimmedUrl, `${backendUrl.origin}/`).toString();
    return isSafeHttpUrl(resolvedUrl) ? resolvedUrl : '';
  } catch (_) {
    const host = apiHost.replace(/\/api\/?$/i, '').replace(/\/+$/, '');
    const path = trimmedUrl.replace(/^\/+/, '');
    const resolvedUrl = `${host}/${path}`;
    return isSafeHttpUrl(resolvedUrl) ? resolvedUrl : '';
  }
}

function getReportKey(report) {
  return report?.commentId || report?.id || report?._id || '';
}

/**
 * CommunityReportsCarousel component displays community reports/comments for an earthquake event
 * in a carousel format with auto-rotation and featured report display.
 *
 * @component
 * @param {Object} props
 * @param {Array} props.reports - Community reports for the event
 * @param {boolean} props.loading - Whether reports are loading
 * @param {string} props.error - Loading error message
 * @param {function} props.onReportClick - Callback when featured report is clicked
 * @returns {JSX.Element|null} - Carousel component or null if no reports
 */
function CommunityReportsCarousel({
  reports = [],
  loading = false,
  error = '',
  onReportClick,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const previewReports = useMemo(() => reports.slice(0, MAX_PREVIEW_REPORTS), [reports]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [previewReports]);

  useEffect(() => {
    if (prefersReducedMotion || isPaused || previewReports.length <= 1) return undefined;

    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % previewReports.length);
    }, CAROUSEL_ROTATION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isPaused, prefersReducedMotion, previewReports.length]);

  const currentReport = useMemo(
    () => (previewReports.length > 0 ? previewReports[currentIndex] : null),
    [previewReports, currentIndex]
  );
  const currentReportImage = useMemo(() => {
    const rawImageUrl =
      currentReport?.imageURL ||
      currentReport?.imageUrl ||
      currentReport?.image ||
      currentReport?.photoUrl ||
      currentReport?.photo;
    return rawImageUrl ? resolveImageUrl(rawImageUrl) : '';
  }, [currentReport]);
  const hasCurrentReportImage = Boolean(currentReportImage);

  const handleNavigateToReport = useCallback(() => {
    const reportId = getReportKey(currentReport);
    if (!reportId) return;
    onReportClick?.();
    const reportElement = document.getElementById(`comment-${reportId}`);
    if (reportElement) {
      reportElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentReport, onReportClick]);

  const handleDotClick = useCallback((index) => {
    setIsPaused(true);
    setCurrentIndex(index);
  }, []);

  return (
    <>
      {loading && !reports.length && (
        <div className={`${styles.emptyState} eqinfo-empty-state`} role="status" aria-live="polite">
          Loading community reports...
        </div>
      )}

      {error && !reports.length && (
        <div className={`${styles.emptyState} eqinfo-empty-state`} role="alert">
          {error}
        </div>
      )}

      {previewReports.length > 0 && currentReport && (
        <div
          className={styles.carouselContainer}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
        >
          <div
            className={`${styles.featuredReportContainer} ${!hasCurrentReportImage ? styles.featuredReportContainerNoImage : ''}`}
            style={{
              backgroundImage: (() => {
                const fallbackGradient = 'linear-gradient(135deg, rgba(5, 10, 18, 0.3), rgba(5, 10, 18, 0.5))';
                if (currentReportImage) return `url(${currentReportImage}), ${fallbackGradient}`;
                return fallbackGradient;
              })()
            }}
            onClick={handleNavigateToReport}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNavigateToReport();
              } else if (e.key === ' ') {
                e.preventDefault();
                handleNavigateToReport();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="View full report"
          >
            <div className={styles.contentOverlay}>
              <div className={styles.reportContent}>
                <h4 className={styles.username}>
                  {currentReport.username || 'Anonymous'}
                </h4>
                {currentReport.content ? (
                  <p className={styles.comment}>{currentReport.content}</p>
                ) : (
                  <p className={styles.comment}>Image report</p>
                )}
              </div>
            </div>
          </div>

          {previewReports.length > 1 && (
            <div className={styles.dotsContainer} aria-label="Community report slides">
              {previewReports.map((_, index) => (
                <button
                  key={index}
                  className={`${styles.dot} ${
                    index === currentIndex ? styles.active : ''
                  }`}
                  onClick={() => handleDotClick(index)}
                  aria-label={`Go to preview report ${index + 1} of ${previewReports.length}`}
                  aria-current={index === currentIndex ? 'true' : 'false'}
                  type="button"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && previewReports.length === 0 && (
        <div className={`${styles.emptyState} eqinfo-empty-state`} role="status">
          No community reports yet.
        </div>
      )}
    </>
  );
}

export default CommunityReportsCarousel;
