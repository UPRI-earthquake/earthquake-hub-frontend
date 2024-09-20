// src/StationDownloadButtons.js
import React from 'react';
import './StationDownloadButton.css';

const StationDownloadButtons = (stationInfo) => {
  
  function formatDateTime(dateString, secondsToAdd = 0) {
    const date = new Date(dateString);
    date.setUTCHours(date.getUTCHours() - 8); // -8hours since this is Ph Time (to make this UTC time)
    date.setUTCSeconds(date.getUTCSeconds() + secondsToAdd); // Add or subtract the specified number of seconds
    
    // Extract the updated year, month, day, hour, minute, second
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-based, so add 1
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    
    // Format as yyyy-MM-ddTHH%3Amm%3Ass (with URL-encoded colons)
    return `${year}-${month}-${day}T${hours}%3A${minutes}%3A${seconds}`;
  }

  const stationCode = stationInfo.stationCode;
  const startTime = formatDateTime(stationInfo.eventTime, -60);
  const endTime = formatDateTime(stationInfo.eventTime, 60*10); // seconds to minutes

  return (
    <div className="download-links">
      <a 
        href={`https://earthquake.science.upd.edu.ph/fdsnws/station/1/query?level=response&starttime=${startTime}&endtime=${endTime}&station=${stationCode}&formatted=true&nodata=404`} 
        className="station-download-links" 
        target="_blank" 
        rel="noopener noreferrer">Download Metadata</a>
      <a 
        href={`https://earthquake.science.upd.edu.ph/fdsnws/dataselect/1/query?starttime=${startTime}&endtime=${endTime}&station=${stationCode}&nodata=404`} 
        className="station-download-links" 
        target="_blank" 
        rel="noopener noreferrer">Download Data</a>
    </div>
  );
};

export default StationDownloadButtons;