import React, { useEffect, useMemo, useState } from 'react';
import { FaExternalLinkAlt, FaRegClock, FaRegCompass, FaTimes } from 'react-icons/fa';
import { TbRulerMeasure2 } from 'react-icons/tb';
import moment from '../utils/time';
import './EarthquakeSourceComparison.css';

const UPRI_FAVICON_URL = '/favicon-32x32.png';

const SOURCE_DISPLAY = {
  'earthquake-hub': {
    label: 'UPRI',
    abbreviation: 'UP',
    iconUrl: UPRI_FAVICON_URL,
  },
  phivolcs: {
    label: 'PHIVOLCS',
    abbreviation: 'PH',
    iconUrl: 'https://earthquake.phivolcs.dost.gov.ph/favicon.ico',
  },
  usgs: {
    label: 'USGS',
    abbreviation: 'US',
    iconUrl: 'https://earthquake.usgs.gov/favicon.ico',
  },
};

function getSourceDisplay(source) {
  const key = source?.source?.toLowerCase();
  const fallback = SOURCE_DISPLAY[key] ?? {
    label: source?.source?.toUpperCase() ?? 'Source',
    abbreviation: source?.source?.slice(0, 2).toUpperCase() ?? 'SO',
    iconUrl: null,
  };

  return {
    ...fallback,
    label: source?.sourceLabel ?? fallback.label,
    iconUrl: source?.sourceIconUrl ?? fallback.iconUrl,
  };
}

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

function stripMagnitudePrefix(value) {
  if (!value) return null;
  return String(value).replace(/^M\s*[\d.]+\s*-\s*/i, '').trim();
}

function getPrimaryLocation(event) {
  const place = event?.place;
  if (place && place !== 'Unavailable') return place;
  return event?.location || event?.text || null;
}

function buildHubSource(event) {
  return {
    source: 'earthquake-hub',
    sourceLabel: 'UPRI',
    sourceIconUrl: UPRI_FAVICON_URL,
    title: 'UPRI solution',
    time: event?.OT || event?.eventTime,
    magnitude: event?.magnitude ?? event?.magnitude_value,
    depth: event?.depth ?? event?.depth_value,
    latitude: event?.latitude ?? event?.latitude_value,
    longitude: event?.longitude ?? event?.longitude_value,
    location: getPrimaryLocation(event),
  };
}

function formatSignedMagnitudeDelta(value) {
  const num = toFiniteNumber(value);
  if (num == null) return null;
  if (Math.abs(num) < 0.05) return 'Match';
  return `${num > 0 ? '+' : ''}${num.toFixed(1)}`;
}

function buildCompactRows(mainSource, comparisonSources) {
  const mainMagnitude = toFiniteNumber(mainSource?.magnitude);
  const primaryDisplay = getSourceDisplay(mainSource);
  const primaryRow = {
    key: 'primary',
    source: mainSource?.source,
    details: null,
    label: primaryDisplay.label,
    iconUrl: primaryDisplay.iconUrl,
    abbreviation: primaryDisplay.abbreviation,
    magnitude: formatMagnitude(mainMagnitude),
    status: 'Reference',
    statusTone: 'match',
  };

  const sourceRows = comparisonSources.map((source) => {
    const magnitude = toFiniteNumber(source?.magnitude);
    const signedDelta = mainMagnitude == null || magnitude == null ? null : magnitude - mainMagnitude;
    const status = formatSignedMagnitudeDelta(signedDelta);
    const display = getSourceDisplay(source);

    return {
      key: source.source ?? source.id ?? source.url,
      source: source.source,
      details: source,
      label: display.label,
      iconUrl: display.iconUrl,
      abbreviation: display.abbreviation,
      magnitude: formatMagnitude(magnitude),
      status: status ?? '—',
      statusTone: status === 'Match' ? 'match' : 'delta',
    };
  });

  return [primaryRow, ...sourceRows];
}

function SourceIcon({ src, abbreviation }) {
  const [hasError, setHasError] = useState(false);

  return (
    <span className="source-compact-icon" aria-hidden="true">
      {src && !hasError ? (
        <img src={src} alt="" loading="lazy" onError={() => setHasError(true)} />
      ) : (
        <span className="source-compact-icon-fallback">{abbreviation}</span>
      )}
    </span>
  );
}

function MetricIcon({ type }) {
  if (type === 'time') return <FaRegClock className="source-compare-metric-icon" aria-hidden="true" />;
  if (type === 'depth') return <TbRulerMeasure2 className="source-compare-metric-icon" aria-hidden="true" />;
  if (type === 'coordinates') return <FaRegCompass className="source-compare-metric-icon" aria-hidden="true" />;
  return null;
}

function getSourceDetails(source, isPrimary = false) {
  const descriptor = source.location || source.place || stripMagnitudePrefix(source.title);
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
    !isPrimary && formatDelta(source.timeDifferenceMinutes, 'min origin time offset'),
    !isPrimary && formatDelta(source.magnitudeDifference, 'magnitude offset', 2),
    !isPrimary && formatDelta(source.distanceKm, 'km epicenter offset', 1),
  ].filter(Boolean);

  return { descriptor, metrics, comparisonChips };
}

function MagnitudeBadge({ source, label }) {
  const magnitudeValue = formatMagnitude(source.magnitude);
  if (!magnitudeValue) return null;

  return (
    <span className="source-compare-mag-badge" aria-label={`${label} magnitude ${magnitudeValue}`}>
      {source.source?.toLowerCase() === 'phivolcs' ? 'Mw' : 'M'} {magnitudeValue.replace(/^M/, '')}
    </span>
  );
}

function CatalogDetailsModal({ source, onClose }) {
  useEffect(() => {
    if (!source) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, source]);

  if (!source) return null;

  const display = getSourceDisplay(source);
  const catalogUrl = source.url ?? source.detailUrl;
  const { descriptor, metrics, comparisonChips } = getSourceDetails(source);

  return (
    <div className="source-details-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="source-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-details-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="source-details-heading">
          <div className="source-details-title-group">
            <SourceIcon src={display.iconUrl} abbreviation={display.abbreviation} />
            <div>
              <p className="source-compare-eyebrow">Matched catalog record</p>
              <h3 id="source-details-title">{display.label}</h3>
            </div>
          </div>
          <div className="source-details-heading-actions">
            <MagnitudeBadge source={source} label={display.label} />
            <button
              type="button"
              className="source-details-close"
              aria-label="Close catalog details"
              onClick={onClose}
            >
              <FaTimes aria-hidden="true" />
            </button>
          </div>
        </div>

        <section className="source-details-record" aria-label={`${display.label} catalog details`}>
          {descriptor ? <p className="source-compare-location">{descriptor}</p> : null}

          <div className="source-compare-metrics">
            {metrics.map((metric) => (
              <div key={`${display.label}-${metric.label}`} className="source-compare-metric">
                <MetricIcon type={metric.icon} />
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>

          {comparisonChips.length > 0 ? (
            <div className="source-compare-chips" aria-label={`${display.label} comparison highlights`}>
              {comparisonChips.map((chip) => (
                <span key={`${display.label}-${chip}`} className="source-compare-chip">
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        {catalogUrl ? (
          <a
            className="source-details-link"
            href={catalogUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open catalog entry
            <FaExternalLinkAlt aria-hidden="true" />
          </a>
        ) : null}
      </section>
    </div>
  );
}

export function SourceComparisonCompact({ earthquakeInfo }) {
  const [selectedSource, setSelectedSource] = useState(null);
  const comparisonSources = useMemo(
    () => Object.values(earthquakeInfo?.additionalInformation ?? {}).filter(Boolean),
    [earthquakeInfo?.additionalInformation],
  );
  const mainSource = useMemo(() => buildHubSource(earthquakeInfo), [earthquakeInfo]);
  const rows = useMemo(
    () => buildCompactRows(mainSource, comparisonSources),
    [comparisonSources, mainSource],
  );

  if (comparisonSources.length === 0) return null;

  return (
    <section className="eqinfo-panel source-compact-panel">
      <div className="panel-header source-compact-heading">
        <h3>Other catalog records</h3>
      </div>

      <div className="source-compact-list">
        {rows.map((row) => {
          const content = (
            <>
              <SourceIcon src={row.iconUrl} abbreviation={row.abbreviation} />
              <strong className="source-compact-name">{row.label}</strong>
              <span className="source-compact-mag">{row.magnitude ?? '—'}</span>
              <span className={`source-compact-status source-compact-status-${row.statusTone}`}>
                {row.status}
              </span>
            </>
          );

          if (!row.details) {
            return (
              <div key={row.key} className="source-compact-row">
                {content}
              </div>
            );
          }

          return (
            <button
              key={row.key}
              type="button"
              className="source-compact-row source-compact-row-action"
              onClick={() => setSelectedSource(row.details)}
              aria-label={`View ${row.label} catalog match details`}
            >
              {content}
            </button>
          );
        })}
      </div>

      <CatalogDetailsModal source={selectedSource} onClose={() => setSelectedSource(null)} />
    </section>
  );
}
