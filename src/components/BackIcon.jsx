import React from 'react';
import './BackIcon.css'; // Adjust the path as needed
import backIcon from './backIcon.png';
/**
 * Decorative back icon image used in headers.
 */
const BackIcon = () => {
  return (
    <div className="back-icon">
      <img src={backIcon} alt="Back" />
    </div>
  );
};

export default BackIcon;
