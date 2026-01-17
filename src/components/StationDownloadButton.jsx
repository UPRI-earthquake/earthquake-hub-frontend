// src/StationDownloadButtons.js
import React from 'react';
import './StationDownloadButton.css';
import Button from './Button';
import { trackEvent } from '../analytics';
import axios from 'axios';

/**
 * Download links for station metadata and waveform around event time.
 */
const StationDownloadButtons = (stationInfo) => {
  const network = 'AM';
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
  const stationCodeUpper = String(stationCode || '').toUpperCase();
  const startTime = formatDateTime(stationInfo.eventTime, -60);
  const endTime = formatDateTime(stationInfo.eventTime, 60 * 10); // seconds to minutes
  const dateSuffix = (() => {
    const d = new Date(stationInfo.eventTime || Date.now());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}${dd}${yy}`;
  })();
  const metadataFilename = `${network}.${stationCodeUpper}.00.MULTI.xml`;
  const waveformFilename = `${network}.${stationCodeUpper}.00.MULTI.${dateSuffix}.mseed`;

  const emitDownload = (kind) => {
    try {
      trackEvent('download_data', {
        type: kind,
        source: 'event_details',
        station_code: stationCode,
      });
    } catch (_) {}
  };

  const fetchAndDownload = async (url, filename, kind, acceptHeader) => {
    try {
      emitDownload(kind);
      const resp = await axios.get(url, {
        responseType: 'blob',
        withCredentials: false,
        validateStatus: () => true,
        headers: acceptHeader ? { Accept: acceptHeader } : undefined,
        timeout: 15000,
      });
      if (resp.status !== 200) {
        window.open(url, '_blank', 'noreferrer');
        return;
      }
      const blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data]);
      if (!blob || blob.size === 0) {
        window.open(url, '_blank', 'noreferrer');
        return;
      }
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objUrl);
    } catch (_) {
      try { window.open(url, '_blank', 'noreferrer'); } catch (_) {}
    }
  };

  return (
    <div className="download-links">
      <Button
        hasOutline
        data-size="compact"
        aria-label={`Download station metadata for ${stationCodeUpper} (XML)`}
        title={`Download station metadata for ${stationCodeUpper}`}
        onClick={() =>
          fetchAndDownload(
            `https://earthquake.science.upd.edu.ph/fdsnws/station/1/query?level=response&starttime=${startTime}&endtime=${endTime}&station=${stationCode}&formatted=true&nodata=404`,
            metadataFilename,
            'metadata',
            'application/xml, text/xml; q=0.9, */*; q=0.1'
          )
        }
      >
        Metadata
      </Button>
      <Button
        data-size="compact"
        aria-label={`Download waveform for ${stationCodeUpper} (MiniSEED)`}
        title={`Download waveform for ${stationCodeUpper}`}
        onClick={() =>
          fetchAndDownload(
            `https://earthquake.science.upd.edu.ph/fdsnws/dataselect/1/query?starttime=${startTime}&endtime=${endTime}&station=${stationCode}&nodata=404`,
            waveformFilename,
            'waveform',
            'application/vnd.fdsn.mseed, application/octet-stream, */*;q=0.1'
          )
        }
      >
        Waveform
      </Button>
    </div>
  );
};

export default StationDownloadButtons;
