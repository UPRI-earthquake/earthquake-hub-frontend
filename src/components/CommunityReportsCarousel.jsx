import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import styles from './CommunityReportsCarousel.module.css';
import { getBackendHost } from '../utils/backendHost';
import thumbnailImage from '../assets/thumbnail.jpg';

const CAROUSEL_ROTATION_INTERVAL_MS = 6000; // 6 seconds

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
   // If already an allowed absolute URL, return as-is
   if (isSafeDataImageUrl(trimmedUrl) || isSafeHttpUrl(trimmedUrl) || isSafeProtocolRelativeUrl(trimmedUrl)) {
     return trimmedUrl;
   }
   // Reject other explicit URI schemes (for example, javascript:)
   if (/^[a-z][a-z\d+.-]*:/i.test(trimmedUrl)) return '';
   // If relative path, construct from backend host
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

/**
 * CommunityReportsCarousel component displays community reports/comments for an earthquake event
 * in a carousel format with auto-rotation and featured report display.
 *
 * @component
 * @param {Object} props
 * @param {string} props.eventId - The earthquake event ID
 * @param {function} props.onReportClick - Callback when featured report is clicked
 * @param {function} props.onReportsLoaded - Callback when reports are loaded with count
 * @returns {JSX.Element|null} - Carousel component or null if no reports
 */
function CommunityReportsCarousel({ eventId, onReportClick, onReportsLoaded }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch community reports/comments for the event
  const fetchCommunityReports = useCallback(async (signal) => {
    if (!eventId) {
      setReports([]);
      setLoading(false);
      setError('');
      setCurrentIndex(0);
      onReportsLoaded?.(0);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const backendHost = getBackendHost();
      if (!backendHost) {
        throw new Error('Backend host is not configured.');
      }

      // Construct the API endpoint to fetch comments for the event
      const endpoint = `${backendHost}/comments/`;
      
      const response = await axios.get(endpoint, {
        params: { eventId }, 
        withCredentials: true, 
        signal,
        timeout: 10000 
      });
      
      if (response.data?.payload && Array.isArray(response.data.payload)) {
        setReports(response.data.payload);
        setCurrentIndex(0);
        onReportsLoaded?.(response.data.payload.length);
      } else {
        setReports([]);
        onReportsLoaded?.(0);
      }
    } catch (err) {
      if (axios.isCancel?.(err) || signal?.aborted) {
        return;
      }
      setError('Unable to load community reports.');
      setReports([]);
      onReportsLoaded?.(0);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [eventId, onReportsLoaded]);

  // Fetch reports on component mount or when eventId changes
  useEffect(() => {
    const controller = new AbortController();
    fetchCommunityReports(controller.signal);
    return () => controller.abort();
  }, [fetchCommunityReports]);

  // Auto-rotate carousel
  useEffect(() => {
    if (reports.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % reports.length);
    }, CAROUSEL_ROTATION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [reports.length]);

  const currentReport = useMemo(
    () => (reports.length > 0 ? reports[currentIndex] : null),
    [reports, currentIndex]
  );

     const handleNavigateToReport = useCallback(() => {
     if (!currentReport?.id && !currentReport?._id) return;
     // Trigger any parent-level navigation first so the final scroll
     // can target the specific report element.
     onReportClick?.();
     // Scroll to the actual report in the reports section
     const reportId = currentReport.id || currentReport._id;
     const reportElement = document.getElementById(`comment-${reportId}`);
     if (reportElement) {
       reportElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
     }
   }, [currentReport, onReportClick]);
   const handleDotClick = useCallback((index) => {
    setCurrentIndex(index);
  }, []);

  return (
    <>
      {loading && !reports.length && (
        <div className={styles.emptyState}>Loading community reports…</div>
      )}

      {error && !reports.length && (
        <div className={styles.emptyState}>Unable to load community reports.</div>
      )}

      {reports.length > 0 && currentReport && (
        <div className={styles.carouselContainer}>
          <div
            className={styles.featuredReportContainer}
            style={{
              backgroundImage: (() => {
                const rawImageUrl =
                  currentReport.imageURL ||
                  currentReport.imageUrl ||
                  currentReport.image ||
                  currentReport.photoUrl ||
                  currentReport.photo;
                const resolvedImageUrl = rawImageUrl ? resolveImageUrl(rawImageUrl) : '';
                if (resolvedImageUrl) return `url(${resolvedImageUrl})`;
                if (thumbnailImage) return `url(${thumbnailImage})`;
                return 'linear-gradient(135deg, rgba(5, 10, 18, 0.3), rgba(5, 10, 18, 0.5))';
              })()
            }}
            onClick={() => {
              handleNavigateToReport();
            }}
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
            aria-label="Click to view full report"
          >
            <div className={styles.contentOverlay}>
              <div className={styles.reportContent}>
                <h4 className={styles.username}>
                  {currentReport.username || 'Anonymous'}
                </h4>
                <p className={styles.comment}>
                  {currentReport.content || 'No comment text'}
                </p>
              </div>
            </div>
          </div>

          {reports.length > 1 && (
            <div className={styles.dotsContainer}>
              {reports.map((_, index) => (
                <button
                  key={index}
                  className={`${styles.dot} ${
                    index === currentIndex ? styles.active : ''
                  }`}
                  onClick={() => handleDotClick(index)}
                  aria-label={`Go to report ${index + 1} of ${reports.length}`}
                  aria-current={index === currentIndex ? 'true' : 'false'}
                  type="button"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className={styles.emptyState}>No community reports yet.</div>
      )}
    </>
  );
}

export default CommunityReportsCarousel;
