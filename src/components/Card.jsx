import React from 'react';
import './Card.css';
import bgImage from '../assets/UPRI_sultan_kudarat.png';

/**
 * Card used in Significant Earthquakes list.
 */
const Card = ({ title, magnitude, location, date, time, description, onClick }) => {
  return (
    <div
      className="card"
      style={{ backgroundImage: `url(${bgImage})` }}
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
      <div className="card-content">
        <h4>{title}</h4>
        <div className="hover-details">
          <h4>Magnitude {magnitude}</h4>
          <h5>{location}</h5>
          <h5>
            {date} - {time}
          </h5>
          <p dangerouslySetInnerHTML={{ __html: description }}></p>
        </div>
      </div>
    </div>
  );
};

export default Card;
