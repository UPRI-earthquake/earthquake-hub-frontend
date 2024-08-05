// src/StationDownloadButtons.js
import React from 'react';
import './StationDownloadButton.css';

const StationDownloadButtons = (statationCode) => {
  return (
    <div className="download-links">
      <a href ='#' className="station-download-links">Download Metadata</a>
      <a href ='#' className="station-download-links">Download Data</a>
    </div>
  );
};

export default StationDownloadButtons;