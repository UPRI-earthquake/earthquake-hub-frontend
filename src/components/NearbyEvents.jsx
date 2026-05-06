import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from '../utils/time';
import { calculateDistance } from '../utils/distanceCalculator';
import axios from 'axios';
import { backendHost } from '../utils/env';
import styles from './NearbyEvents.module.css';

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

  const currentLat = Number(earthquakeInfo?.latitude_value);
  const currentLon = Number(earthquakeInfo?.longitude_value);
  const currentTime = earthquakeInfo?.OT || earthquakeInfo?.eventTime;
  const currentPublicID = earthquakeInfo?.publicID;

  // Fetch nearby events
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!Number.isFinite(currentLat) || !Number.isFinite(currentLon) || !currentTime || !currentPublicID) {
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
      const eventId = event?.publicID;
      const detailUrl = eventId
        ? `/earthquake-detail?id=${encodeURIComponent(eventId)}`
        : '/earthquake-detail';

      navigate(detailUrl, {
        state: { earthquake: event },
      });
    },
    [navigate]
  );

  if (!currentPublicID) return null;

  return (
    <section className={styles.nearbyEventsPanel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <h3>Nearby events</h3>
          {nearbyEvents.length > 0 && (
            <span className={styles.eventCount}>
              within {distanceThresholdKm} km
            </span>
          )}
        </div>
      </div>

      <div className={styles.panelBody}>
        {loading ? (
          <div className={styles.loader} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden />
            <span>Loading nearby events…</span>
          </div>
        ) : nearbyEvents.length === 0 ? (
          <div className={styles.empty}>
            No events found within {distanceThresholdKm} km in the last 30 days.
          </div>
        ) : (
          <ul className={styles.eventList}>
            {nearbyEvents.map((event) => (
              <li
                key={event.publicID}
                onClick={() => handleEventClick(event)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleEventClick(event);
                  } else if (e.key === ' ') {
                    e.preventDefault();
                    handleEventClick(event);
                  }
                }}
                role="button"
                tabIndex="0"
                aria-label={`Magnitude ${formatMagnitude(event)} - ${formatLocation(event)}`}
                className={styles.eventItem}
              >
                <div className={styles.eventMainContent}>
                  <div className={styles.magnitudeSection}>
                    <span className={styles.magnitude}>
                      M{formatMagnitude(event)}
                    </span>
                  </div>
                  <div className={styles.eventDetails}>
                    <div className={styles.location}>
                      {formatLocation(event)}
                    </div>
                    <div className={styles.eventMeta}>
                      <span className={styles.time}>{formatTime(event.OT || event.eventTime)}</span>
                      <span className={styles.separator}>•</span>
                      <span className={styles.depth}>{formatDepth(event)}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.distanceSection}>
                  <span className={styles.distance}>
                    {formatDistance(event.distance)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default NearbyEvents;
