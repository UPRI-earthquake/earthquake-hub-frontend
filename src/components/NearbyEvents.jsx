import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from '../utils/time';
import { calculateDistance } from '../utils/distanceCalculator';
import axios from 'axios';
import { backendHost } from '../utils/env';
import '../pages/EQInfoPage.css';

/**
 * NearbyEvents component displays earthquakes nearby to the current earthquake.
 * Shows magnitude, location, time, depth, and distance from the current event.
 */
function NearbyEvents({
  earthquakeInfo,
  nearbyEventCount = 5,
  distanceThresholdKm = 200,
}) {
  const navigate = useNavigate();
  const [nearbyEvents, setNearbyEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);

  const currentLat = earthquakeInfo?.latitude_value;
  const currentLon = earthquakeInfo?.longitude_value;
  const currentTime = earthquakeInfo?.OT || earthquakeInfo?.eventTime;
  const currentPublicID = earthquakeInfo?.publicID;

  // Fetch nearby events
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!currentLat || !currentLon || !currentTime || !currentPublicID) {
      return;
    }

    const fetchNearby = async () => {
      try {
        setLoading(true);
        const endDate = moment(currentTime);
        const startDate = moment(currentTime).subtract(30, 'days');

        try {
          axios.defaults.withCredentials = true;
        } catch (_) {}

        const response = await axios.get(`${backendHost()}/eq-events`, {
          params: {
            startTime: startDate.format('YYYY-MM-DD HH:mm:ss'),
            endTime: endDate.format('YYYY-MM-DD HH:mm:ss'),
          },
        });

        const events = response.data?.payload || [];

        const nearby = events
          .filter((event) => {
            if (event.publicID === currentPublicID) return false;
            const lat = event.latitude_value;
            const lon = event.longitude_value;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
            const distance = calculateDistance(currentLat, currentLon, lat, lon);
            return distance <= distanceThresholdKm;
          })
          .map((event) => {
            const lat = event.latitude_value;
            const lon = event.longitude_value;
            const distance = calculateDistance(currentLat, currentLon, lat, lon);
            return { ...event, distance };
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, nearbyEventCount);

        if (isMountedRef.current) {
          setNearbyEvents(nearby);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error fetching nearby events:', error);
        }
        if (isMountedRef.current) {
          setNearbyEvents([]);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchNearby();

    return () => {
      isMountedRef.current = false;
    };
  }, [currentLat, currentLon, currentTime, currentPublicID, nearbyEventCount, distanceThresholdKm]);

  const formatMagnitude = (event) => {
    const val = Number(event?.magnitude_value ?? event?.magnitude ?? event?.mag);
    return Number.isFinite(val) ? val.toFixed(1) : '—';
  };

  const formatDepth = (event) => {
    const depth = Number(event?.depth_km ?? event?.depthKm ?? event?.depth_value ?? event?.depthValue ?? event?.depth);
    return Number.isFinite(depth) ? `${depth.toFixed(0)} km` : '—';
  };

  const formatLocation = (event) => {
    const isUnavailable = (value) => {
      if (!value) return true;
      const v = String(value).trim().toLowerCase();
      return !v || v === 'unavailable' || v === 'unable to geocode';
    };
    if (!isUnavailable(event?.place)) return event.place;
    if (!isUnavailable(event?.text)) return event.text;
    return event?.location || 'Unknown location';
  };

  const formatTime = (eventTime) => moment(eventTime).fromNow();

  const formatDistance = (distance) => {
    return distance < 1 ? '<1 km' : `~${Math.round(distance)} km`;
  };

  const handleEventClick = useCallback(
    (event) => {
      navigate('/earthquake-detail', {
        state: { earthquake: event },
      });
    },
    [navigate]
  );

  if (!currentPublicID) return null;

  return (
    <section className="eqinfo-panel scrollable">
      <div className="panel-header">
        <div className="panel-title">
          <h3>Nearby events</h3>
          {nearbyEvents.length > 0 && (
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', marginLeft: '12px' }}>
              within {distanceThresholdKm} km
            </span>
          )}
        </div>
      </div>

      <div className="panel-body">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '32px 16px', color: 'var(--muted)' }} role="status" aria-live="polite">
            <div style={{ width: '16px', height: '16px', border: '2px solid rgba(75, 85, 99, 0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} aria-hidden />
            <span>Loading nearby events…</span>
          </div>
        ) : nearbyEvents.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', backgroundColor: 'var(--panel-subtle)', borderRadius: 'var(--radius-md)' }}>
            No events found within {distanceThresholdKm} km in the last 30 days.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {nearbyEvents.map((event) => (
              <li
                key={event.publicID}
                onClick={() => handleEventClick(event)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleEventClick(event);
                  } else if (e.key === ' ') {
                    e.preventDefault();
                    handleEventClick(event);
                  }
                }}
                role="button"
                tabIndex="0"
                aria-label={`Magnitude ${formatMagnitude(event)} - ${formatLocation(event)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: 'var(--panel-subtle)',
                  border: '1px solid rgba(229, 231, 235, 0.6)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--panel-subtle)';
                  e.currentTarget.style.borderColor = 'rgba(229, 231, 235, 0.6)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    width: '48px',
                    height: '48px',
                    background: 'linear-gradient(135deg, #E53935 0%, #D32F2F 100%)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 2px 8px rgba(229, 57, 53, 0.2)',
                  }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}>
                      M{formatMagnitude(event)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3, wordBreak: 'break-word' }}>
                      {formatLocation(event)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--muted)' }}>
                      <span>{formatTime(event.OT || event.eventTime)}</span>
                      <span style={{ opacity: 0.5 }}>•</span>
                      <span>{formatDepth(event)}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0, paddingLeft: '8px' }}>
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: '#475569',
                    whiteSpace: 'nowrap',
                    padding: '4px 8px',
                    background: '#f1f5f9',
                    borderRadius: '6px',
                    minWidth: '60px',
                    textAlign: 'right',
                  }}>
                    {formatDistance(event.distance)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}

export default NearbyEvents;
