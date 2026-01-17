import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import StationDownloadButtons from '../components/StationDownloadButton';
import Articles from '../components/Articles';
import moment from '../utils/time';
import { getBackendHost } from '../utils/backendHost';
import sanitizeHtml from '../utils/sanitizeHtml';
import InfoTooltip from '../components/InfoTooltip';
import './EQInfoPage.css';

// Normalize backend list fields that may arrive as an Array or a bracketed CSV string.
function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const stripped = trimmed.startsWith('[') && trimmed.endsWith(']')
      ? trimmed.slice(1, -1)
      : trimmed;
    return stripped
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Significant Earthquake detail page. Fetches event information by `id` from
 * the query string and renders an information table with download links.
 * @returns {JSX.Element}
 */
function EQInfoPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const id = queryParams.get('id'); // Get the object_id from the query parameter
  const [earthquakeInfo, setEarthquakeInfo] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const formatEventTime = useCallback((eventTime) => {
    const parsed = moment(eventTime);
    if (!parsed || !parsed.isValid()) return 'Date unavailable';
    return parsed.format('MMMM D, YYYY h:mm A');
  }, []);

  // Function for getting earthquake information based on id
  const fetchEarthquakeInfo = useCallback(async (signal) => {
    setError('');
    if (!id) {
      setLoading(false);
      setError('No earthquake id was provided.');
      return;
    }
    try {
      // Get eq info from backend
      const backendHost = getBackendHost();
      if (!backendHost) {
        throw new Error('Backend host is not configured.');
      }

      const response = await axios.post(
        `${backendHost}/significant-eqs`,
        { id },
        { withCredentials: true, signal },
      );

      setEarthquakeInfo(response.data.payload);
    } catch (error) {
      if (axios.isCancel?.(error) || signal?.aborted) return;
      // Handle any error that occurred during the request
      console.error('Error:', error.message);
      setError(error?.response?.data?.message || error?.message || 'Unable to load this event.');
      setEarthquakeInfo(undefined);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [id]);

  // Fetch data when id changes
  useEffect(() => {
    const controller = new AbortController();
    fetchEarthquakeInfo(controller.signal);
    return () => controller.abort();
  }, [fetchEarthquakeInfo]);

  const summaryMarkup = useMemo(
    () => sanitizeHtml(earthquakeInfo?.eventSummary || ''),
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
      : earthquakeInfo?.magnitude;
  const depthValue = Number(earthquakeInfo?.depth);
  const depth = Number.isFinite(depthValue) ? `${depthValue.toFixed(0)} km` : null;
  const formattedEventTime = earthquakeInfo?.eventTime
    ? formatEventTime(earthquakeInfo.eventTime)
    : null;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (earthquakeInfo?.title) {
      document.title = `${earthquakeInfo.title} | Earthquake Hub`;
    } else {
      document.title = 'Significant Earthquake | Earthquake Hub';
    }
  }, [earthquakeInfo?.title]);

  return (
    <>
      <Header />
      <div className="eqinfo-shell">
        {loading ? (
          <div className="eqinfo-panel muted">Loading event details…</div>
        ) : error ? (
          <div className="eqinfo-panel alert" role="status">
            {error}
          </div>
        ) : earthquakeInfo ? (
          <>
            <section className="eqinfo-hero">
              <h1>{earthquakeInfo.title}</h1>
              <div className="eqinfo-meta-grid">
                <div className="metric-card" role="group" aria-label={`Magnitude ${magnitude || 'not available'}`} title={`Magnitude ${magnitude || 'Not available'}`}>
                  <span>Magnitude</span>
                  <strong>{magnitude || '—'}</strong>
                </div>
                <div className="metric-card" role="group" aria-label={`Depth ${depth || 'not available'}`} title={`Depth ${depth || 'Not available'}`}>
                  <span>Depth</span>
                  <strong>{depth || '—'}</strong>
                </div>
                <div className="metric-card" role="group" aria-label={`Location ${earthquakeInfo.location || 'not available'}`} title={`Location ${earthquakeInfo.location || 'Not available'}`}>
                  <span>Location</span>
                  <strong>{earthquakeInfo.location || '—'}</strong>
                </div>
                <div className="metric-card" role="group" aria-label={`Local time ${formattedEventTime || 'not available'}`} title={`Local time ${formattedEventTime || 'Not available'}`}>
                  <span>Local time</span>
                  <strong>{formattedEventTime ? `${formattedEventTime} (Local)` : '—'}</strong>
                </div>
              </div>
            </section>

            <div className="eqinfo-grid">
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
                          <StationDownloadButtons stationCode={station} eventTime={earthquakeInfo.eventTime} />
                        </div>
                      </li>
                    ))}
                    {!instrumentRecordings.length && (
                      <li className="muted">No recordings published for this event.</li>
                    )}
                  </ul>
                </div>
              </section>

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
            </div>
          </>
        ) : (
          <div className="eqinfo-panel muted">No details were found for this event.</div>
        )}
      </div>
    </>
  );
}

export default EQInfoPage;
