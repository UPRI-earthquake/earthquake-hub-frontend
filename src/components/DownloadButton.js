import React from 'react';
import './DownloadButton.css';

const DownloadButtons = () => {
  return (
    <div className="buttons">
      <button className="download-button">Download All Metadata</button>
      <button className="download-button">Download All Data</button>
    </div>
  );
};

export default DownloadButtons;
