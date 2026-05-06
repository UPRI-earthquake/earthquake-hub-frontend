import React, { useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
import StationDownloadButtons from '../components/StationDownloadButton';
import Articles from '../components/Articles';
import NearbyEvents from '../components/NearbyEvents';
import moment from '../utils/time';
import sanitizeHtml from '../utils/sanitizeHtml';
import { generateEventSummary } from '../utils/generateEventSummary';
import { normalizeList } from '../utils/normalizeList';
import InfoTooltip from '../components/InfoTooltip';
import EarthquakeSourceComparison from '../components/EarthquakeSourceComparison';
import './EQInfoPage.css';

/**
 * Earthquake detail page for network-detected earthquakes. Displays event information
 * passed via navigation state from the earthquakes list page.
 * @returns {JSX.Element}
 */
function EarthquakeDetailPage() {
  const location = useLocation();
  const eventId = useMemo(() => {
    try {
      return new URLSearchParams(location.search || '').get('id');
    } catch (_) {
      return null;
    }
  }, [location.search]);
  const earthquakeInfo = useMemo(() => {
    if (location.state?.earthquake) return location.state.earthquake;
    if (!eventId || typeof window === 'undefined') return null;
    try {
      const cached = window.localStorage.getItem(`earthquake-detail:${eventId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  }, [location.state, eventId]);
  
  const formatEventTime = useCallback((eventTime) => {
    const parsed = moment(eventTime);
    if (!parsed || !parsed.isValid()) return 'Date unavailable';
    return parsed.format('MMMM D, YYYY h:mm A');
  }, []);

  const summaryMarkup = useMemo(
    () => sanitizeHtml(earthquakeInfo?.eventSummary || generateEventSummary(earthquakeInfo)), //using generated summary as fallback if eventSummary is not provided
    [earthquakeInfo],
  );
  const instrumentRecordings = useMemo(
    () => normalizeList(earthquakeInfo?.instrumentRecordings),
    [earthquakeInfo?.instrumentRecordings],
  );
  const references = useMemo(() => normalizeList(earthquakeInfo?.references), [earthquakeInfo?.references]);

  const magnitude =
    typeof earthquakeInfo?.magnitude === 'number'
      ? earthquakeInfo.magnitude.toFixed(1).replace(/\.0$/, '')
      : typeof earthquakeInfo?.magnitude_value === 'number'
      ? earthquakeInfo.magnitude_value.toFixed(1).replace(/\.0$/, '')
      : earthquakeInfo?.magnitude;

  const depthValue = Number(
    earthquakeInfo?.depth_km ?? earthquakeInfo?.depth ?? earthquakeInfo?.depth_value,
  );
  const depth = Number.isFinite(depthValue) ? `${depthValue.toFixed(0)} km` : null;

  const eventTime = earthquakeInfo?.eventTime || earthquakeInfo?.OT;
  const formattedEventTime = eventTime ? formatEventTime(eventTime) : null;

  const placeDescription = earthquakeInfo?.place || '';
  const genericLocation = earthquakeInfo?.location || earthquakeInfo?.text || 'Location unavailable';

  // Use place description for location if available, otherwise use generic location
  const locationDisplay = placeDescription && placeDescription !== 'Unavailable'
    ? placeDescription
    : genericLocation;

  // Generate dynamic title: "M6.8 Earthquake 067 km N 87° E of Cagwait (Surigao Del Sur)"
  const pageTitle = useMemo(() => {
    if (earthquakeInfo?.title) return earthquakeInfo.title;
    
    const magText = magnitude ? `M${magnitude} Earthquake` : 'Earthquake';
    
    if (placeDescription && placeDescription !== 'Unavailable') {
      return `${magText} ${placeDescription}`;
    } else if (genericLocation) {
      return `${magText} ${genericLocation}`;
    }
    
    return magText;
  }, [magnitude, placeDescription, genericLocation, earthquakeInfo?.title]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = `${pageTitle} | Earthquake Hub`;
  }, [pageTitle]);

  // If no earthquake data show error
  if (!earthquakeInfo) {
    return (
      <>
        <Header />
        <div className="eqinfo-shell">
          <div className="eqinfo-panel alert" role="status">
            No earthquake data available. Please select an earthquake from the list.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="eqinfo-shell">
        <section className="eqinfo-hero">
          <h1>{pageTitle}</h1>
          <div className="eqinfo-meta-grid">
            <div className="metric-card" role="group" aria-label={`Magnitude ${magnitude || 'not available'}`} title={`Magnitude ${magnitude || 'Not available'}`}>
              <span>Magnitude</span>
              <strong>{magnitude || '—'}</strong>
            </div>
            <div className="metric-card" role="group" aria-label={`Depth ${depth || 'not available'}`} title={`Depth ${depth || 'Not available'}`}>
              <span>Depth</span>
              <strong>{depth || '—'}</strong>
            </div>
            <div className="metric-card" role="group" aria-label={`Location ${locationDisplay || 'not available'}`} title={`Location ${locationDisplay || 'Not available'}`}>
              <span>Location</span>
              <strong>{locationDisplay || '—'}</strong>
            </div>
            <div className="metric-card" role="group" aria-label={`Local time ${formattedEventTime || 'not available'}`} title={`Local time ${formattedEventTime || 'Not available'}`}>
              <span>Local time</span>
              <strong>{formattedEventTime ? `${formattedEventTime} (Local)` : '—'}</strong>
            </div>
          </div>
        </section>

        <div className="eqinfo-grid">
          <NearbyEvents
            earthquakeInfo={earthquakeInfo}
            nearbyEventCount={5}
            distanceThresholdKm={200}
          />

          {summaryMarkup && (
            <section className="eqinfo-panel scrollable">
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Event summary</h3>
                  <InfoTooltip title="Event summary" label="About this section" variant="inline">
                    Vetted narrative from authoritative sources.
                  </InfoTooltip>
                </div>
              </div>
              <div className="panel-body">
                <div
                  className="eqinfo-copy"
                  dangerouslySetInnerHTML={{ __html: summaryMarkup }}
                />
              </div>
            </section>
          )}

          <EarthquakeSourceComparison earthquakeInfo={earthquakeInfo} />

          {instrumentRecordings.length > 0 && (
            <section className="eqinfo-panel scrollable">
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Instrument recordings</h3>
                  <InfoTooltip title="Instrument recordings" label="About this section" variant="inline">
                    Download station traces around the event origin time.
                  </InfoTooltip>
                </div>
              </div>
              <div className="panel-body">
                <ul className="station-list">
                  {instrumentRecordings.map((station, idx) => (
                    <li key={`${station}-${idx}`} aria-label={`Station ${station}`}>
                      <div className="list-items">
                        <div className="station-label">{station}</div>
                        <StationDownloadButtons stationCode={station} eventTime={eventTime} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {references.length > 0 && (
            <section className="eqinfo-panel scrollable">
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Reports & references</h3>
                  <InfoTooltip title="Reports & references" label="About this section" variant="inline">
                    Open source links in a new tab.
                  </InfoTooltip>
                </div>
              </div>
              <div className="panel-body">
                <div className="reference-grid">
                  {references.map((reference, index) => (
                    <Articles key={`ref-${index}`} url={reference} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {!summaryMarkup && instrumentRecordings.length === 0 && references.length === 0 && (
            <section className="eqinfo-panel scrollable">
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Event details</h3>
                </div>
              </div>
              <div className="panel-body">
                <p className="muted">
                  This earthquake was detected by the network. Additional analysis and authoritative reports may be available from official sources.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default EarthquakeDetailPage;
