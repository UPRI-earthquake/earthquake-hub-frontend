import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from '../utils/time';
import { calculateDistance } from '../utils/distanceCalculator';
import axios from 'axios';
import { backendHost } from '../utils/env';
import styles from './NearbyEvents.module.css';

/**
 * NearbyEvents component displays earthquakes within the configured time and distance window.
 * Shows magnitude, location, event-relative time, and distance from the current event.
 */
function NearbyEvents({
  earthquakeInfo,
  nearbyEventCount = 5,
  distanceThresholdKm = 200,
  timeWindowDays = 30,
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
        const startDate = moment(currentTime).subtract(timeWindowDays, 'days');
        const endDate = moment(currentTime).add(timeWindowDays, 'days');

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
        const currentMoment = moment.utc(currentTime);

        const nearby = events
          .filter((event) => {
            if (event.publicID === currentPublicID) return false;
            const lat = event.latitude_value;
            const lon = event.longitude_value;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
            const eventMoment = moment.utc(event.OT || event.eventTime);
            if (!eventMoment.isValid() || !currentMoment.isValid()) return false;
            const distance = calculateDistance(currentLat, currentLon, lat, lon);
            return distance <= distanceThresholdKm;
          })
          .map((event) => {
            const lat = event.latitude_value;
            const lon = event.longitude_value;
            const distance = calculateDistance(currentLat, currentLon, lat, lon);
            const eventMoment = moment.utc(event.OT || event.eventTime);
            const timeDeltaMinutes = Math.abs(currentMoment.diff(eventMoment, 'minute'));
            return { ...event, distance, timeDeltaMinutes };
          })
          .sort((a, b) => {
            if (a.timeDeltaMinutes !== b.timeDeltaMinutes) {
              return a.timeDeltaMinutes - b.timeDeltaMinutes;
            }
            return a.distance - b.distance;
          })
          .slice(0, nearbyEventCount)
          .sort((a, b) => {
            const aTime = moment.utc(a.OT || a.eventTime).valueOf();
            const bTime = moment.utc(b.OT || b.eventTime).valueOf();
            if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
              return aTime - bTime;
            }
            return a.distance - b.distance;
          });

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
  }, [currentLat, currentLon, currentTime, currentPublicID, nearbyEventCount, distanceThresholdKm, timeWindowDays]);

  const formatMagnitude = (event) => {
    const val = Number(event?.magnitude_value ?? event?.magnitude ?? event?.mag);
    return Number.isFinite(val) ? val.toFixed(1) : '—';
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

  const formatTimeFromCurrentEvent = (eventTime) => {
    const eventMoment = moment.utc(eventTime);
    const currentMoment = moment.utc(currentTime);
    if (!eventMoment.isValid() || !currentMoment.isValid()) return null;

    const diffMinutes = currentMoment.diff(eventMoment, 'minute');
    const absMinutes = Math.abs(diffMinutes);
    if (absMinutes < 1) return 'same time';

    const value = absMinutes >= 1440
      ? Math.round(absMinutes / 1440)
      : absMinutes >= 60
        ? Math.round(absMinutes / 60)
        : absMinutes;
    const unit = absMinutes >= 1440 ? 'd' : absMinutes >= 60 ? 'h' : 'm';
    const suffix = diffMinutes >= 0 ? 'before' : 'after';
    return `${value}${unit} ${suffix}`;
  };

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
          <h3>Related events</h3>
          {nearbyEvents.length > 0 && (
            <span className={styles.eventCount}>
              within {distanceThresholdKm} km ±{timeWindowDays} days
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
            No events found within {distanceThresholdKm} km from {timeWindowDays} days before to {timeWindowDays} days after this event.
          </div>
        ) : (
          <ul className={styles.eventList}>
            {nearbyEvents.map((event) => {
              const eventTime = event.OT || event.eventTime;
              const timeOffset = formatTimeFromCurrentEvent(eventTime);

              return (
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
                      {timeOffset && (
                        <div className={styles.eventMeta}>
                          <span className={styles.timeOffset}>
                            {timeOffset}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.distanceSection}>
                    <span className={styles.distance}>
                      {formatDistance(event.distance)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export default NearbyEvents;
