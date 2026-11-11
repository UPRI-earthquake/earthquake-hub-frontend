import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import ErrorScreen from '@/shared/ui/components/ErrorScreen';
import '../styles/EarthquakeDetailsView.css';
import useEarthquakeInfo from '../../hooks/useEarthquakeInfo';
import BannerSection from './sections/banner/BannerSection';
import ReportSection from './sections/reports/ReportsSection';
import EarthquakeDetailSkeleton from './EarthquakeDetailsSkeleton';
import ReportImageViewer from './sections/reports/ReportImageViewer';
import EventSummarySection from './sections/EventSummarySection';
import RelatedEventsSection from './sections/RelatedEventsSection';
import OtherRecordsSection from './sections/OtherRecordsSection';
import StationRecordingsSection from './sections/station-recordings/StationRecordingsSection';
import { FiX } from 'react-icons/fi';
import { getAppEnvironment } from '@/config/env';





/**
 * Earthquake detail page for network-detected earthquakes. Displays event information
 * passed via navigation state from the earthquakes list page.
 * If location.state?.earthquake is missing (e.g., on refresh/direct navigation),
 * reads the id from URL query params and fetches the earthquake data.
 */
export default function EarthquakeDetailsView() {
  const {
    eventId, 
    earthquakeInfo,
    earthquakeLabel,
    debugInfo, 
    status: { 
      isFetching, fetchError,
      isRecordingAvailabilityPending, 
      recordingAvailabilityStatus
    },
    stations: { 
      source: stationListSource,
      list: stationsForDisplay 
    },
    reload
  } = useEarthquakeInfo();

  const [isEventTransitioning, setIsEventTransitioning] = useState(false);
  const [waveformSentinelRef, shouldMountWaveforms] = useNearViewport();
  const [displaySummary, setDisplaySummary] = useState('');
  
  const [selectedReportImage, setSelectedReportImage] = useState(null);
  const [isRecordingsModalOpen, setIsRecordingsModalOpen] = useState(false);
  
  const reportsRef = useRef(null);
  const previousEventIdRef = useRef(eventId);
  const isDevelopment = getAppEnvironment() === 'development';

  const hasWaveformStations = stationsForDisplay.length > 0;
  
  useEffect(() => {
    const previousEventId = previousEventIdRef.current;
    if (!previousEventId || previousEventId === eventId) {
      previousEventIdRef.current = eventId;
      return undefined;
    }

    previousEventIdRef.current = eventId;
    setIsEventTransitioning(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const timer = window.setTimeout(() => {
      setIsEventTransitioning(false);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [eventId]);

  // Sync displaySummary with earthquakeInfo
  useEffect(() => {
    const summary = earthquakeInfo?.summaryOverride?.text || earthquakeInfo?.eventSummary || '';
    setDisplaySummary(summary);
  }, [earthquakeInfo?.summaryOverride?.text, earthquakeInfo?.eventSummary]);


  const closeRecordingsModal = useCallback(() => {
    setIsRecordingsModalOpen(false);
  }, []);

  useEffect(() => {
    if (!isRecordingsModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRecordingsModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeRecordingsModal, isRecordingsModalOpen]);



  // Debug: Check earthquake object structure
  if (isDevelopment && typeof window !== 'undefined') {
    window["_earthquakeDebug"] = debugInfo;
  }

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = `${earthquakeLabel} | Earthquake Hub`;
  }, [earthquakeLabel]);

  // Show loading screen while fetching only when there is no event data to render yet.
  if (!earthquakeInfo && isFetching) return <EarthquakeDetailSkeleton onRetry={reload} />;

  // Show error screen if fetch failed
  if (!earthquakeInfo && fetchError)
    return (<div className={`eqinfo-shell ${isEventTransitioning ? 'eqinfo-shell-transitioning' : ''}`}>
          <ErrorScreen
            title="Unable to Load Earthquake"
            message={fetchError}
            actionLabel="Back to Events"
            onAction={() => window.history.back()}
          />
        </div>);

  // If no earthquake data show error
  if (!isFetching && !earthquakeInfo)
    return (<div className="eqinfo-shell">
      <div className="eqinfo-panel alert" role="status">
        No earthquake data available. Please select an earthquake from the list.
      </div>
    </div>);
  

  return (
    <>
      <div className="eqinfo-shell">
        
        <BannerSection />
        <div className="eqinfo-main-columns">
          <div className="eqinfo-main-column eqinfo-main-column-reference">
            <EventSummarySection
              initialSummary={displaySummary}
              earthquakeInfo={earthquakeInfo}
              className="eqinfo-panel-summary-only"
            />

            <RelatedEventsSection
              earthquakeInfo={earthquakeInfo}
              nearbyEventCount={5}
              distanceThresholdKm={200}
            />

            <OtherRecordsSection earthquakeInfo={earthquakeInfo} />
          </div>

          <div className="eqinfo-main-column eqinfo-main-column-community">
            {hasWaveformStations ? (
              <div ref={waveformSentinelRef} className="eqinfo-support-section">
                {shouldMountWaveforms ? (
                  <Suspense fallback={<div className="eqinfo-panel muted">Loading waveform viewer...</div>}>
                    <StationRecordingsSection
                      availabilityStatus={recordingAvailabilityStatus}
                      isAvailabilityPending={isRecordingAvailabilityPending}
                      stationListSource={stationListSource}
                      initialVisibleCount={3}
                      onViewAllStations={() => setIsRecordingsModalOpen(true)}
                      className="station-recordings-overview"
                    />
                  </Suspense>
                ) : (
                  <div className="eqinfo-panel muted">Preparing station recordings...</div>
                )}
              </div>
            ) : null}

            <div ref={reportsRef}>
              <ReportSection onAttachmentPreview={setSelectedReportImage} />
            </div>
          </div>
        </div>
      </div>
      <ReportImageViewer
        image={selectedReportImage}
        onClose={() => setSelectedReportImage(null)}
      />
      {isRecordingsModalOpen && (
        <div className="recordings-modal-backdrop" role="presentation" onMouseDown={closeRecordingsModal}>
          <div
            className="recordings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recordings-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="recordings-modal-titlebar">
              <div>
                <h3 id="recordings-modal-title">All Station Recordings</h3>
                <p>{formatStationCount(stationsForDisplay.length)} with available waveform access for this event.</p>
              </div>
              <button
                type="button"
                className="report-icon-button recordings-modal-close"
                onClick={closeRecordingsModal}
                aria-label="Close station recordings"
              >
                <FiX />
              </button>
            </div>
            <Suspense fallback={<div className="eqinfo-panel muted">Loading waveform viewer...</div>}>
              <StationRecordingsSection
                availabilityStatus={recordingAvailabilityStatus}
                isAvailabilityPending={isRecordingAvailabilityPending}
                stationListSource={stationListSource}
                showAllByDefault
                showStationToggle={false}
                className="station-recordings-viewer"
                title="Station Recordings"
                onViewAllStations={null}
              />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}



function useNearViewport(rootMargin = '600px'): [React.Dispatch<any>, boolean] {
  const [targetNode, setTargetNode] = useState(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    if (isNearViewport || !targetNode) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(targetNode);
    return () => observer.disconnect();
  }, [isNearViewport, rootMargin, targetNode]);

  return [setTargetNode, isNearViewport];
}




function formatStationCount(count) {
  const numericCount = Number(count);
  if (!Number.isFinite(numericCount) || numericCount <= 0) return 'No stations';
  return `${numericCount} ${numericCount === 1 ? 'station' : 'stations'}`;
}