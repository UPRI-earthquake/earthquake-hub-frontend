import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaExternalLinkAlt, FaInfoCircle, FaRegClock, FaRegCompass, FaTimes } from 'react-icons/fa';
import { TbRulerMeasure2 } from 'react-icons/tb';
import {
  formatCoordinate,
  formatDepth,
  formatEventTimePh,
  formatMagnitude,
  stripMagnitudePrefix,
  toFiniteNumber,
} from '../utils/earthquakeFormat';
import './CatalogComparison.css';

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

const MATCH_QUALITY_LABELS = {
  high: 'Strong match',
  medium: 'Likely match',
  low: 'Possible match',
};

const MATCH_QUALITY_THRESHOLDS = {
  high: { timeMinutes: 2, distanceKm: 100, magnitude: 0.5 },
  medium: { timeMinutes: 5, distanceKm: 250, magnitude: 1 },
  low: { timeMinutes: 10, distanceKm: 500, magnitude: 1.5 },
};

const CATALOG_CONTENT_FIELDS = [
  'dateTime',
  'detailUrl',
  'id',
  'title',
  'place',
  'location',
  'url',
  'detail',
  'queryUrl',
  'time',
  'latitude',
  'longitude',
  'depth',
  'depthKm',
  'magnitude',
  'distanceKm',
  'timeDifferenceMinutes',
  'magnitudeDifference',
  'score',
];

function hasCatalogValue(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return value != null && typeof value !== 'boolean';
}

function isCatalogSourceAvailable(source) {
  if (!source || typeof source !== 'object') return false;
  return CATALOG_CONTENT_FIELDS.some((field) => hasCatalogValue(source[field]));
}

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

function getDerivedMatchQuality(source) {
  const timeDiff = toFiniteNumber(source?.timeDifferenceMinutes);
  const distance = toFiniteNumber(source?.distanceKm);
  const magnitudeDiff = toFiniteNumber(source?.magnitudeDifference);

  if (timeDiff == null || distance == null || magnitudeDiff == null) return null;

  if (
    timeDiff <= MATCH_QUALITY_THRESHOLDS.high.timeMinutes &&
    distance <= MATCH_QUALITY_THRESHOLDS.high.distanceKm &&
    magnitudeDiff <= MATCH_QUALITY_THRESHOLDS.high.magnitude
  ) {
    return 'high';
  }

  if (
    timeDiff <= MATCH_QUALITY_THRESHOLDS.medium.timeMinutes &&
    distance <= MATCH_QUALITY_THRESHOLDS.medium.distanceKm &&
    magnitudeDiff <= MATCH_QUALITY_THRESHOLDS.medium.magnitude
  ) {
    return 'medium';
  }

  if (
    timeDiff <= MATCH_QUALITY_THRESHOLDS.low.timeMinutes &&
    distance <= MATCH_QUALITY_THRESHOLDS.low.distanceKm &&
    magnitudeDiff <= MATCH_QUALITY_THRESHOLDS.low.magnitude
  ) {
    return 'low';
  }

  return null;
}

function getMatchQualityLabel(source) {
  const key = source?.matchQuality?.toLowerCase?.() ?? getDerivedMatchQuality(source);
  return MATCH_QUALITY_LABELS[key] ?? null;
}

function formatEventTime(value) {
  if (!value) return null;
  return formatEventTimePh(value, true);
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

function getSourceDetails(source) {
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
    formatDelta(source.timeDifferenceMinutes, 'min origin time offset'),
    formatDelta(source.magnitudeDifference, 'magnitude offset', 2),
    formatDelta(source.distanceKm, 'km epicenter offset', 1),
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
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!source) return undefined;

    const previousActiveElement = document.activeElement;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousActiveElement?.focus?.();
    };
  }, [onClose, source]);

  if (!source) return null;

  const display = getSourceDisplay(source);
  const catalogUrl = source.url ?? source.detailUrl;
  const { descriptor, metrics, comparisonChips } = getSourceDetails(source);
  const matchQualityLabel = getMatchQualityLabel(source);

  const modal = (
    <div className="source-details-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={modalRef}
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
              <div className="source-details-eyebrow-row">
                <p className="source-compare-eyebrow">Matched catalog record</p>
              </div>
              <div className="source-details-label-row">
                <h3 id="source-details-title">{display.label}</h3>
                {matchQualityLabel ? (
                  <span className="source-match-quality-pill">{matchQualityLabel}</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="source-details-heading-actions">
            <MagnitudeBadge source={source} label={display.label} />
            <button
              ref={closeButtonRef}
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

  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
}

export default function CatalogComparison({ earthquakeInfo }) {
  const [selectedSource, setSelectedSource] = useState(null);
  const comparisonSources = useMemo(
    () => Object.values(earthquakeInfo?.additionalInformation ?? {}).filter(isCatalogSourceAvailable),
    [earthquakeInfo?.additionalInformation],
  );
  const mainSource = useMemo(() => buildHubSource(earthquakeInfo), [earthquakeInfo]);
  const rows = useMemo(
    () => buildCompactRows(mainSource, comparisonSources),
    [comparisonSources, mainSource],
  );

  if (!earthquakeInfo) return null;

  return (
    <section className="eqinfo-panel source-compact-panel">
      <div className="panel-header source-compact-heading">
        <h3>Other catalog records</h3>
      </div>

      <div className="source-compact-list">
        <div className="source-compact-row source-compact-header" aria-hidden="true">
          <span className="source-compact-header-source">Source</span>
          <span className="source-compact-header-mag">Magnitude recording</span>
          <span className="source-compact-header-offset">Offset</span>
        </div>
        {rows.map((row) => {
          const content = (
            <>
              <SourceIcon src={row.iconUrl} abbreviation={row.abbreviation} />
              <strong className="source-compact-name">{row.label}</strong>
              <span className="source-compact-mag">{row.magnitude ?? '—'}</span>
              <span className={`source-compact-status source-compact-status-${row.statusTone}`}>
                {row.status}
              </span>
              <span className="source-compact-affordance" aria-hidden="true">
                {row.details ? <FaInfoCircle /> : null}
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
