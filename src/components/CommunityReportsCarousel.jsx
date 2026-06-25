import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiUser } from 'react-icons/fi';
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
  if (!apiHost) return trimmedUrl;

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

function getReportImage(report) {
  const rawImageUrl =
    report?.imageURL ||
    report?.imageUrl ||
    report?.image ||
    report?.photoUrl ||
    report?.photo;
  return rawImageUrl ? resolveImageUrl(rawImageUrl) : '';
}

function getHelpfulCount(report) {
  const rawCount = Number(report?.helpfulCount ?? report?.helpful_count ?? 0);
  return Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0;
}

function getReportTimestamp(report) {
  const rawTimestamp = report?.createdAt || report?.created_at || report?.timestamp || report?.date;
  if (!rawTimestamp) return 0;
  const parsedTimestamp = new Date(rawTimestamp).getTime();
  return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0;
}

function getAuthorInitials(author) {
  if (!author || author.toLowerCase() === 'anonymous') return '';
  return author
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getReportPreviewPayload(report) {
  const imageSrc = getReportImage(report);
  const author = (report?.username || 'Anonymous').trim();
  const text = typeof report?.content === 'string' ? report.content.trim() : '';

  return {
    reportId: getReportKey(report),
    src: imageSrc,
    alt: `Submitted report attachment from ${author}`,
    overlay: {
      author,
      text,
    },
  };
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
 * @param {function} props.onImagePreview - Callback when featured report image is opened
 * @returns {JSX.Element|null} - Carousel component or null if no reports
 */
function CommunityReportsCarousel({
  reports = [],
  loading = false,
  error = '',
  onReportClick,
  onImagePreview,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const previewReports = useMemo(
    () => reports
      .map((report, index) => ({ report, index }))
      .filter(({ report }) => Boolean(getReportImage(report)))
      .sort((a, b) => {
        const helpfulDifference = getHelpfulCount(b.report) - getHelpfulCount(a.report);
        if (helpfulDifference !== 0) return helpfulDifference;

        const timeDifference = getReportTimestamp(b.report) - getReportTimestamp(a.report);
        if (timeDifference !== 0) return timeDifference;

        return a.index - b.index;
      })
      .slice(0, MAX_PREVIEW_REPORTS)
      .map(({ report }) => report),
    [reports]
  );

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
  const currentReportImage = useMemo(() => getReportImage(currentReport), [currentReport]);
  const hasCurrentReportImage = Boolean(currentReportImage);
  const currentReportText = typeof currentReport?.content === 'string' ? currentReport.content.trim() : '';
  const currentReportAuthor = (currentReport?.username || 'Anonymous').trim();
  const shouldShowAuthor = Boolean(currentReportAuthor && currentReportAuthor.toLowerCase() !== 'anonymous');
  const shouldShowText = Boolean(currentReportText);
  const shouldShowOverlay = hasCurrentReportImage;
  const authorInitials = getAuthorInitials(currentReportAuthor);

  const handleNavigateToReport = useCallback(() => {
    const reportId = getReportKey(currentReport);
    if (!reportId) return;
    onReportClick?.();
    const reportElement = document.getElementById(`comment-${reportId}`);
    if (reportElement) {
      reportElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentReport, onReportClick]);

  const handleFeaturedReportAction = useCallback(() => {
    if (hasCurrentReportImage && onImagePreview) {
      const gallery = previewReports
        .map(getReportPreviewPayload)
        .filter((item) => Boolean(item.src));
      const galleryIndex = gallery.findIndex((item) => item.reportId === getReportKey(currentReport));
      const currentPreview = gallery[galleryIndex] || getReportPreviewPayload(currentReport);

      onImagePreview?.({
        ...currentPreview,
        source: 'community-carousel',
        gallery,
        galleryIndex: galleryIndex >= 0 ? galleryIndex : 0,
      });
      return;
    }
    handleNavigateToReport();
  }, [
    currentReport,
    handleNavigateToReport,
    hasCurrentReportImage,
    onImagePreview,
    previewReports,
  ]);

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
            onClick={handleFeaturedReportAction}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFeaturedReportAction();
              } else if (e.key === ' ') {
                e.preventDefault();
                handleFeaturedReportAction();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={hasCurrentReportImage ? 'Open report image' : 'View full report'}
          >
            {shouldShowOverlay && (
              <div className={styles.contentOverlay}>
                <div className={styles.reportContent}>
                  <span
                    className={`${styles.authorAvatar} ${!shouldShowAuthor ? styles.authorAvatarAnonymous : ''}`}
                    title={currentReportAuthor}
                    aria-label={`Reported by ${currentReportAuthor}`}
                  >
                    {shouldShowAuthor ? authorInitials : <FiUser aria-hidden="true" />}
                  </span>
                  {shouldShowText && (
                    <p className={styles.comment}>{currentReportText}</p>
                  )}
                </div>
              </div>
            )}
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
          No image reports yet.
        </div>
      )}
    </>
  );
}

export default CommunityReportsCarousel;
