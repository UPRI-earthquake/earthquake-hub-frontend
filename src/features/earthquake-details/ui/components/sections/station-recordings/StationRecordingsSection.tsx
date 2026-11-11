import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import styles from '../../../styles/sections/StationRecordingsSection.module.css';
import InfoTooltip from '@/shared/ui/components/InfoTooltip';
import moment from '@/shared/utils/time';
import { FiChevronDown, FiMaximize2 } from 'react-icons/fi';
import useEarthquakeInfo from '../../../../hooks/useEarthquakeInfo';
import useStationsList from '../../../../hooks/useStationsList';
import StationItem from './StationItem';
import { getEventCoordinates } from '@/features/earthquake-details/services/earthquake';
import { getStationDistanceLabel } from '@/features/earthquake-details/services/stations';
import { DEFAULT_VISIBLE_STATION_COUNT } from '@/features/earthquake-details/constants/recordings';

/**
 * SeismicWaveforms component displays recorded seismic waveforms for multiple stations
 * during an earthquake event. Each station shows a compact waveform visualization with
 * access to station metadata.
 */
interface StationRecordingsSectionProps {
  availabilityStatus?: string;
  isAvailabilityPending?: boolean;
  stationListSource?: string;
  initialVisibleCount?: number;
  showAllByDefault?: boolean;
  showStationToggle?: boolean;
  onViewAllStations: () => void;
  className?: string;
  title?: string;
}

export default function StationRecordingsSection({
  availabilityStatus = 'verified',
  isAvailabilityPending = false,
  stationListSource = 'verified',
  initialVisibleCount = DEFAULT_VISIBLE_STATION_COUNT,
  showAllByDefault = false,
  showStationToggle = true,
  onViewAllStations,
  className = '',
  title = 'Station Recordings',
}: StationRecordingsSectionProps) {
  const { earthquakeInfo } = useEarthquakeInfo();
  const { allStations, stationLocationsByCode } = useStationsList();
  const [showAllStations, setShowAllStations] = useState(showAllByDefault);
  const containerRef = useRef(null);
  const requestedWaveformsRef = useRef(new Set());

  const stations = useMemo(() => allStations.map(s => s.code), [allStations]);
  const stationList = useMemo(
    () => (Array.isArray(stations) ? stations : []),
    [stations]
  );
  const hasStations = stationList.length > 0;
  const visibleStationCount = Math.max(1, Number(initialVisibleCount) || DEFAULT_VISIBLE_STATION_COUNT);
  const visibleStations = useMemo(
    () => (showAllStations ? stationList : stationList.slice(0, visibleStationCount)),
    [showAllStations, stationList, visibleStationCount]
  );
  const canToggleStations = stationList.length > visibleStationCount;
  const eventCoordinates = useMemo(
    () => getEventCoordinates(earthquakeInfo),
    [earthquakeInfo]
  );

  useEffect(() => {
    setShowAllStations(showAllByDefault);
  }, [showAllByDefault, stationList.length]);

  // Format times for data retrieval
  const formatDateTime = useCallback((dateString, secondsOffset = 0) => {
    const parsed = moment.utc(dateString);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.add(secondsOffset, 'seconds').format('YYYY-MM-DDTHH:mm:ss');
  }, []);

  
  const eventTimeKey = earthquakeInfo?.eventTime || earthquakeInfo?.OT || '';
  const startTime = formatDateTime(eventTimeKey, -60);
  const endTime = formatDateTime(eventTimeKey, 600);

  

  useEffect(() => {
    requestedWaveformsRef.current = new Set();
    setShowAllStations(showAllByDefault);
  }, [eventTimeKey, showAllByDefault]);

  const availabilityNote = isAvailabilityPending || stationListSource === 'candidate'
    ? 'Candidate stations were active near detection time. Waveform availability is still being checked as FDSN data catches up.'
    : 'Only stations with confirmed data for this event are listed.';

  if (!earthquakeInfo) {
    return null;
  }

  return (
    <section
      className={`${styles.waveformContainer} ${!hasStations ? styles.waveformContainerCompact : ''} ${className}`}
      ref={containerRef}
    >
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <h3>{title}</h3>
          <InfoTooltip title="Station recordings" label="About station recordings" variant="inline">
            {availabilityNote}
          </InfoTooltip>
        </div>
      </div>

      { hasStations ? (
        <>
          <div className={styles.waveformList}>
            {visibleStations.map((stationCode, index) => (
              <StationItem
                key={stationCode}
                stationCode={stationCode}
                startTime={startTime}
                endTime={endTime}
                stationIndex={index}
                earthquakeInfo={earthquakeInfo}
                distanceLabel={getStationDistanceLabel(stationCode, eventCoordinates, stationLocationsByCode)}
                isAvailabilityPending={isAvailabilityPending}
              />
            ))}
          </div>
          {canToggleStations && showStationToggle ? (
            <div className={styles.toggleRow}>
              <button
                type="button"
                className={styles.toggleButton}
                aria-expanded={showAllStations}
                aria-haspopup={onViewAllStations ? 'dialog' : undefined}
                onClick={() => {
                  if (onViewAllStations && !showAllStations) {
                    onViewAllStations();
                    return;
                  }
                  setShowAllStations((prev) => !prev);
                }}
              >
                {onViewAllStations && !showAllStations
                  ? `View all ${stationList.length} stations`
                  : showAllStations
                    ? 'Show fewer stations'
                    : `Show all ${stationList.length} stations`}
                {onViewAllStations && !showAllStations ? (
                  <FiMaximize2 className={styles.toggleIcon} aria-hidden="true" focusable="false" />
                ) : (
                  <FiChevronDown className={styles.toggleIcon} aria-hidden="true" focusable="false" />
                )}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className={`${styles.emptyState} ${styles.emptyStateCompact} eqinfo-empty-state eqinfo-empty-state--compact`}>
          <span>No station recordings</span>
          <small>
            {availabilityStatus === 'pending'
              ? 'Recording availability is still being checked for this event.'
              : 'No online station recordings are currently available for this event.'}
          </small>
        </div>
      )}
    </section>
  );
}