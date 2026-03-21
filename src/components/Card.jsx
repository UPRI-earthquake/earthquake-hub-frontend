import React, { useMemo } from 'react';
import sanitizeHtml from '../utils/sanitizeHtml';
import './Card.css';

/**
 * Card used in Significant Earthquakes list.
 */
const Card = ({ title, magnitude, location, dateLabel, depth, summary, onClick }) => {
  const safeSummary = useMemo(() => sanitizeHtml(summary || ''), [summary]);

  return (
    <div
      className="card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${title || 'earthquake'} at ${location}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick && onClick();
        }
      }}
    >
      <div className="card-surface">
        <div className="card-top">
          <span className="pill pill-strong">Magnitude {magnitude}</span>
          {depth && <span className="pill pill-soft">{depth}</span>}
        </div>
        <h3 className="card-title">{title}</h3>
        <p className="card-meta">{dateLabel}</p>
        <p className="card-location">{location}</p>
        {safeSummary && (
          <div className="card-summary" dangerouslySetInnerHTML={{ __html: safeSummary }} />
        )}
        <div className="card-footer">
          <span className="cta">View details →</span>
        </div>
      </div>
    </div>
  );
};

export default Card;
