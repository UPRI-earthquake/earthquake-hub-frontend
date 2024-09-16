import React from 'react';
import './Card.css';

const Card = ({ title, magnitude, location, date, time, description, onClick }) => {
  return (
    <div className="card" onClick={onClick}>
      <div className="card-content">
        <h3>{title}</h3>
        <div className="hover-details">
          <h4>Magnitude {magnitude}</h4>
          <h5>{location}</h5>
          <h5>{date} - {time}</h5>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
};

export default Card;