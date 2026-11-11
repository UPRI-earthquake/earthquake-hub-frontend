import { useMemo } from "react";
import useEarthquakeInfo from "../../../../hooks/useEarthquakeInfo";
import { getNearestRecordingStation } from "../../../../services/stations";
import { getDepthContext, getEventCoordinates, getEventTimeDisplay, getMagnitudeValue } from "../../../../services/earthquake";
import { formatCoordinatePart } from "../../../../utils/geometry";
import useStationsList from "../../../../hooks/useStationsList";
import { FiArrowDown, FiClock, FiMapPin, FiRadio } from "react-icons/fi";
import MiniMapPreview from "./MiniMapPreview";
import MiniMapDistancePreview from "./MiniMapDistancePreview";
import { EPICENTER_MINI_MAP_ZOOM } from "../../../../constants/minimap";

export default function BannerSection() {
  const { 
    earthquakeInfo, earthquakeLabel,
    derived: { coordText, depth, formattedUpdatedTime, formattedUpdatedTimeUtc },
    stations: {
      list: stationsForDisplay
    }
  } = useEarthquakeInfo();
  const { allStations, stationLocationsByCode } = useStationsList();


  const nearestRecordingStation = useMemo(
    () => getNearestRecordingStation(stationsForDisplay, allStations, earthquakeInfo, stationLocationsByCode),
    [allStations, earthquakeInfo, stationLocationsByCode, stationsForDisplay]
  );
  const eventCoordinates = useMemo(() => getEventCoordinates(earthquakeInfo), [earthquakeInfo]);
  const magnitudeValue = useMemo(() => getMagnitudeValue(earthquakeInfo), [earthquakeInfo]);
  const epicenterParts = useMemo(() => ({
    latitude: formatCoordinatePart(eventCoordinates?.latitude, 'N', 'S'),
    longitude: formatCoordinatePart(eventCoordinates?.longitude, 'E', 'W'),
  }), [eventCoordinates]);
  const depthContext = useMemo(() => getDepthContext(earthquakeInfo), [earthquakeInfo]);
  const eventTimeDisplay = useMemo(() => getEventTimeDisplay(earthquakeInfo), [earthquakeInfo]);
    
  return (<section className="eqinfo-hero">
    <div className="eqinfo-title-row">
      <h1>{earthquakeLabel}</h1>
    </div>
    <div className="eqinfo-meta-grid">
      <div className="metric-card metric-card-depth" role="group" aria-label={`Depth ${depth || 'not available'}`} title={`Depth ${depth || 'Not available'}`}>
        <div className="metric-card-head">
          <span className="metric-icon" aria-hidden="true"><FiArrowDown /></span>
          <span className="metric-label">Depth</span>
        </div>
        <div className="metric-card-body">
          <strong>{depth || '—'}</strong>
          <em className="metric-sub">{depthContext}</em>
        </div>
      </div>
      <div className="metric-card metric-card-time" role="group" aria-label={`Event time ${eventTimeDisplay.primary || 'not available'}`} title={`Event time ${eventTimeDisplay.primary || 'Not available'}`}>
        <div className="metric-card-head">
          <span className="metric-icon" aria-hidden="true"><FiClock /></span>
          <span className="metric-label">Event time</span>
        </div>
        <div className="metric-card-body">
          <strong>{eventTimeDisplay.primary}</strong>
          <em className="metric-sub metric-zone">{eventTimeDisplay.zone}</em>
          <em className="metric-sub metric-tertiary">{eventTimeDisplay.utc}</em>
        </div>
      </div>
      <div className="metric-card metric-map-card metric-card-epicenter" role="group" aria-label={`Epicenter ${coordText || 'not available'}`} title={`Epicenter ${coordText || 'Not available'}`}>
        <MiniMapPreview
          coordinates={eventCoordinates}
          magnitudeValue={magnitudeValue}
          marker="epicenter"
          zoom={EPICENTER_MINI_MAP_ZOOM}
        />
        <div className="metric-map-overlay">
          <div className="metric-card-head">
            <span className="metric-icon" aria-hidden="true"><FiMapPin /></span>
            <span className="metric-label">Epicenter</span>
          </div>
          <div className="metric-map-value">
            <dl className="metric-coordinate-list">
              <div>
                <dt>Lat</dt>
                <dd>{epicenterParts.latitude}</dd>
              </div>
              <div>
                <dt>Lon</dt>
                <dd>{epicenterParts.longitude}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
      <div className="metric-card metric-map-card metric-card-station" role="group" aria-label={`Nearest recording station ${nearestRecordingStation.code || 'not available'}`} title={`Nearest recording station ${nearestRecordingStation.code || 'Not available'}`}>
        <MiniMapDistancePreview
          epicenterCoordinates={eventCoordinates}
          magnitudeValue={magnitudeValue}
          stationCode={nearestRecordingStation.code}
          stationCoordinates={nearestRecordingStation.coordinates}
        />
        <div className="metric-map-overlay metric-map-overlay-station">
          <div className="metric-card-head">
            <span className="metric-icon" aria-hidden="true"><FiRadio /></span>
            <span className="metric-label">Nearest station</span>
          </div>
          <div className="metric-map-value metric-station-map-value">
            <strong>{nearestRecordingStation.code || 'Unavailable'}</strong>
            <em className="metric-sub">
              {getDistanceMapLabel(nearestRecordingStation.subtext) || nearestRecordingStation.subtext}
            </em>
          </div>
        </div>
      </div>
    </div>
    <p className="eqinfo-last-updated">
      Last updated {formattedUpdatedTime ? `${formattedUpdatedTime} UTC+08:00` : 'unavailable'}
      {formattedUpdatedTimeUtc ? ` (${formattedUpdatedTimeUtc} UTC)` : ''}
    </p>
  </section>);
}



function getDistanceMapLabel(distanceLabel) {
  const text = String(distanceLabel || '').trim();
  if (!text || !/^~?<?[\d,.]+\s*km\b/i.test(text)) return '';
  return text.replace(/\s+from\s+epicenter$/i, '');
}