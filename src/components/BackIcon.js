import React from 'react';
import './BackIcon.css'; // Adjust the path as needed
import backIcon from './backIcon.png'
const BackIcon = () => {
  return (
    <div className="back-icon">
      <img src={backIcon}></img>
    </div>
  );
};

export default BackIcon;
