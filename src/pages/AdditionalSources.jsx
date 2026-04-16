import React from 'react';
import { TbRulerMeasure2 } from 'react-icons/tb';
import { FaRegCompass } from 'react-icons/fa';
import './AdditionalSources.css';

const SOURCE_LABELS = {
  phivolcs: 'PHIVOLCS',
  usgs: 'USGS',
};

function SourceCard({ data }) {
  const label = SOURCE_LABELS[data.source?.toLowerCase()] ?? data.source?.toUpperCase();
  const magnitude = typeof data.magnitude === 'number'
    ? data.magnitude.toFixed(1).replace(/\.0$/, '')
    : null;

  const depth = data.depthKm ?? data.depth;
  const depthDisplay = typeof depth === 'number' ? `${depth}km` : null;

  const lat = data.latitude;
  const lng = data.longitude;
  const latDisplay = lat != null ? `${Math.abs(lat).toFixed(3)} ${lat >= 0 ? 'N' : 'S'}` : null;
  const lngDisplay = lng != null ? `${Math.abs(lng).toFixed(3)} ${lng >= 0 ? 'E' : 'W'}` : null;

  const time = data.time ?? data.dateTime;

  return (
    <div className="source-card">
      <div className="source-card-header">
        {magnitude && (
          <span className="source-mag-badge">
            {data.source?.toLowerCase() === 'phivolcs' ? 'Mw' : 'M'} {magnitude}
          </span>
        )}
        <span className="source-name">{label}</span>
      </div>

      <div className="source-metrics">
        {depthDisplay && (
          <div className="source-metric">
            <TbRulerMeasure2 className="source-metric-icon" />
            <span className="source-metric-label">Depth</span>
            <span className="source-metric-value">{depthDisplay}</span>
          </div>
        )}
        {latDisplay && (
          <div className="source-metric">
            <FaRegCompass className="source-metric-icon" />
            <span className="source-metric-label">Latitude</span>
            <span className="source-metric-value">{latDisplay}</span>
          </div>
        )}
        {lngDisplay && (
          <div className="source-metric">
            <FaRegCompass className="source-metric-icon" />
            <span className="source-metric-label">Longitude</span>
            <span className="source-metric-value">{lngDisplay}</span>
          </div>
        )}
      </div>

      {time && (
        <div className="source-time">
          <svg className="source-time-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" strokeLinecap="round" />
          </svg>
          <span>{time}</span>
        </div>
      )}

      {data.url || data.detailUrl ? (
        <a
          className="source-link"
          href={data.url ?? data.detailUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View source ↗
        </a>
      ) : null}
    </div>
  );
}

export default function AdditionalSources({ additionalInformation }) {
  if (!additionalInformation) return null;

  const sources = Object.values(additionalInformation).filter(Boolean);
  if (sources.length === 0) return null;

  return (
    <section className="eqinfo-panel scrollable additional-sources">
      <div className="panel-header">
        <div className="panel-title">
          <h3>Other sources</h3>
        </div>
      </div>
      <div className="panel-body">
        <div className="source-cards-grid">
          {sources.map((src) => (
            <SourceCard key={src.source} data={src} />
          ))}
        </div>
      </div>
    </section>
  );
}