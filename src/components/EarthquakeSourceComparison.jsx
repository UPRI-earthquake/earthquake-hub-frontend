import React, { useMemo } from 'react';
import { FaRegClock, FaRegCompass } from 'react-icons/fa';
import { TbRulerMeasure2 } from 'react-icons/tb';
import InfoTooltip from './InfoTooltip';
import moment from '../utils/time';
import './EarthquakeSourceComparison.css';

const SOURCE_LABELS = {
  'earthquake-hub': 'Earthquake Hub',
  phivolcs: 'PHIVOLCS',
  usgs: 'USGS',
};

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatMagnitude(value) {
  const num = toFiniteNumber(value);
  return num == null ? null : `M${num.toFixed(1).replace(/\.0$/, '')}`;
}

function formatDepth(value) {
  const num = toFiniteNumber(value);
  return num == null ? null : `${num.toFixed(0)} km`;
}

function formatCoordinate(value, positiveLabel, negativeLabel) {
  const num = toFiniteNumber(value);
  if (num == null) return null;
  return `${Math.abs(num).toFixed(3)} ${num >= 0 ? positiveLabel : negativeLabel}`;
}

function formatEventTime(value) {
  if (!value) return null;
  const parsed = moment(value);
  return parsed.isValid() ? parsed.format('MMMM D, YYYY h:mm:ss A') : value;
}

function formatDelta(value, suffix, digits = 1) {
  const num = toFiniteNumber(value);
  return num == null ? null : `${num.toFixed(digits).replace(/\.0$/, '')} ${suffix}`;
}

function getPrimaryLocation(event) {
  const place = event?.place;
  if (place && place !== 'Unavailable') return place;
  return event?.location || event?.text || null;
}

function buildHubSource(event) {
  return {
    source: 'earthquake-hub',
    title: 'Earthquake Hub solution',
    time: event?.OT || event?.eventTime,
    magnitude: event?.magnitude ?? event?.magnitude_value,
    depth: event?.depth ?? event?.depth_value,
    latitude: event?.latitude ?? event?.latitude_value,
    longitude: event?.longitude ?? event?.longitude_value,
    location: getPrimaryLocation(event),
  };
}

function buildOverview(mainSource, comparisonSources) {
  const magnitudes = comparisonSources
    .map((source) => toFiniteNumber(source?.magnitude))
    .filter((value) => value != null);

  const scores = comparisonSources
    .map((source) => toFiniteNumber(source?.score))
    .filter((value) => value != null);

  const timeDiffs = comparisonSources
    .map((source) => toFiniteNumber(source?.timeDifferenceMinutes))
    .filter((value) => value != null);

  const hubMagnitude = formatMagnitude(mainSource?.magnitude);
  const externalMagnitudeRange = magnitudes.length > 0
    ? `${formatMagnitude(Math.min(...magnitudes))} to ${formatMagnitude(Math.max(...magnitudes))}`
    : null;
  const strongestMatch = scores.length > 0 ? `${Math.max(...scores).toFixed(1)} score` : null;
  const closestTimeMatch = timeDiffs.length > 0 ? `${Math.min(...timeDiffs).toFixed(1)} min delta` : null;

  return [
    { label: 'Hub solution', value: hubMagnitude || 'Unavailable' },
    { label: 'External sources', value: `${comparisonSources.length}` },
    ...(externalMagnitudeRange ? [{ label: 'External magnitude range', value: externalMagnitudeRange }] : []),
    ...(closestTimeMatch ? [{ label: 'Closest time match', value: closestTimeMatch }] : []),
    ...(strongestMatch ? [{ label: 'Strongest catalog match', value: strongestMatch }] : []),
  ];
}

function MetricIcon({ type }) {
  if (type === 'time') return <FaRegClock className="source-compare-metric-icon" aria-hidden="true" />;
  if (type === 'depth') return <TbRulerMeasure2 className="source-compare-metric-icon" aria-hidden="true" />;
  if (type === 'coordinates') return <FaRegCompass className="source-compare-metric-icon" aria-hidden="true" />;
  return null;
}

function ComparisonCard({ source, isPrimary = false }) {
  const label = SOURCE_LABELS[source.source?.toLowerCase()] ?? source.source?.toUpperCase() ?? 'Source';
  const magnitudeValue = formatMagnitude(source.magnitude);
  const metrics = [
    { label: 'Origin time', value: formatEventTime(source.time), icon: 'time' },
    { label: 'Depth', value: formatDepth(source.depth ?? source.depthKm), icon: 'depth' },
    {
      label: 'Coordinates',
      value: [
        formatCoordinate(source.latitude, 'N', 'S'),
        formatCoordinate(source.longitude, 'E', 'W'),
      ].filter(Boolean).join(' / '),
      icon: 'coordinates',
    },
  ].filter((item) => item.value);

  const comparisonChips = [
    !isPrimary && formatDelta(source.timeDifferenceMinutes, 'min time delta'),
    !isPrimary && formatDelta(source.magnitudeDifference, 'mag delta', 2),
    !isPrimary && formatDelta(source.distanceKm, 'km from hub', 1),
    !isPrimary && formatDelta(source.score, 'match score', 1),
  ].filter(Boolean);

  return (
    <article className={`source-compare-card${isPrimary ? ' source-compare-card-primary' : ''}`}>
      <div className="source-compare-header">
        <div>
          <p className="source-compare-eyebrow">{isPrimary ? 'Baseline' : 'Reference catalog'}</p>
          <h4>{label}</h4>
        </div>
        {magnitudeValue ? (
          <span className="source-compare-mag-badge" aria-label={`${label} magnitude ${magnitudeValue}`}>
            {source.source?.toLowerCase() === 'phivolcs' ? 'Mw' : 'M'} {magnitudeValue.replace(/^M/, '')}
          </span>
        ) : null}
        {source.title ? <p className="source-compare-title">{source.title}</p> : null}
      </div>

      {source.location ? <p className="source-compare-location">{source.location}</p> : null}

      <div className="source-compare-metrics">
        {magnitudeValue ? (
          <div className="source-compare-metric source-compare-metric-magnitude">
            <span>Magnitude</span>
            <strong>{magnitudeValue}</strong>
          </div>
        ) : null}
        {metrics.map((metric) => (
          <div key={`${label}-${metric.label}`} className="source-compare-metric">
            <MetricIcon type={metric.icon} />
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      {comparisonChips.length > 0 ? (
        <div className="source-compare-chips" aria-label={`${label} comparison highlights`}>
          {comparisonChips.map((chip) => (
            <span key={`${label}-${chip}`} className="source-compare-chip">
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {source.url || source.detailUrl ? (
        <a
          className="source-compare-link"
          href={source.url ?? source.detailUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View catalog entry
        </a>
      ) : null}
    </article>
  );
}

export default function EarthquakeSourceComparison({ earthquakeInfo }) {
  const comparisonSources = useMemo(
    () => Object.values(earthquakeInfo?.additionalInformation ?? {}).filter(Boolean),
    [earthquakeInfo?.additionalInformation],
  );

  const mainSource = useMemo(() => buildHubSource(earthquakeInfo), [earthquakeInfo]);

  if (comparisonSources.length === 0) return null;

  const overviewItems = buildOverview(mainSource, comparisonSources);

  return (
    <section className="eqinfo-panel source-comparison-panel">
      <div className="panel-header source-comparison-heading">
        <div className="panel-title">
          <h3>Earthquake source comparison</h3>
          <InfoTooltip title="Earthquake source comparison" label="About this section" variant="inline">
            Cross-checks the Earthquake Hub event against linked catalog solutions from external agencies.
          </InfoTooltip>
        </div>
      </div>

      <div className="source-compare-overview">
        {overviewItems.map((item) => (
          <div key={item.label} className="source-compare-overview-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="source-compare-grid">
        <ComparisonCard source={mainSource} isPrimary />
        {comparisonSources.map((source) => (
          <ComparisonCard key={source.source ?? source.id ?? source.url} source={source} />
        ))}
      </div>
    </section>
  );
}
