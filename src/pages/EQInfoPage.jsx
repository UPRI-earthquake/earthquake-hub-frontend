import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
import './EQInfoPage.css';
import StationDownloadButtons from '../components/StationDownloadButton';
import Articles from '../components/Articles';
import axios from 'axios';
import moment from 'moment';

/**
 * Significant Earthquake detail page. Fetches event information by `id` from
 * the query string and renders an information table with download links.
 * @returns {JSX.Element}
 */
function EQInfoPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const id = queryParams.get('id'); // Get the object_id from the query parameter
  let [earthquakeInfo, setEarthquakeInfo] = useState();

  // Function for getting earthquake information based on id
  const fetchEarthquakeInfo = useCallback(async () => {
    if (!id) return; // If there's no id, don't fetch
    try {
      // Get eq info from backend
      const backend_host =
        process.env.NODE_ENV === 'production'
          ? window['ENV'].REACT_APP_BACKEND
          : window['ENV'].REACT_APP_BACKEND_DEV;

      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backend_host}/significant-eqs`, { id: id });

      setEarthquakeInfo(response.data.payload);
    } catch (error) {
      // Handle any error that occurred during the request
      console.error('Error:', error.message);
    }
  }, [id]); // Add `id` as a dependency to ensure it fetches when id changes

  // Fetch data when id changes
  useEffect(() => {
    fetchEarthquakeInfo();
  }, [fetchEarthquakeInfo]);

  return (
    <>
      <Header />
      <div className="section">
        <div className="section-container">
          {earthquakeInfo ? (
            <>
              <div className="table-container">
                <table className="eq-info-table">
                  <tbody>
                    <tr>
                      <th colSpan={3}>
                        <h2>{earthquakeInfo.title}</h2>
                      </th>
                    </tr>
                    <tr>
                      <td className="first-column ">Date & Time:</td>
                      <td>
                        {moment(earthquakeInfo.eventTime).format('MMMM D, YYYY h:mm:ss A z')} (Local
                        Time)
                      </td>
                    </tr>
                    <tr>
                      <td className="first-column ">Location:</td>
                      <td>{earthquakeInfo.location}</td>
                    </tr>
                    <tr>
                      <td className="first-column ">Magnitude:</td>
                      <td>{earthquakeInfo.magnitude}</td>
                    </tr>
                    <tr className="instrument">
                      <td className="first-column">Instrument Recordings:</td>
                      <td>
                        <ul className="station">
                          {earthquakeInfo.instrumentRecordings &&
                            earthquakeInfo.instrumentRecordings.map((station, index) => (
                              <li>
                                <div className="list-items">
                                  <p>
                                    <b>{station}</b>
                                  </p>
                                  <StationDownloadButtons
                                    key={index}
                                    stationCode={station}
                                    eventTime={earthquakeInfo.eventTime}
                                  />
                                </div>
                              </li>
                            ))}
                        </ul>
                      </td>
                    </tr>
                    <tr>
                      <td className="first-column ">Event Summary:</td>
                      <td
                        colSpan={2}
                        dangerouslySetInnerHTML={{ __html: earthquakeInfo.eventSummary }}
                      ></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2>Reports:</h2>
              <div className="reference">
                {earthquakeInfo.references &&
                  earthquakeInfo.references.map((reference, index) => (
                    <Articles key={index} url={reference} />
                  ))}
              </div>
            </>
          ) : (
            <></>
          )}
        </div>
      </div>
    </>
  );
}

export default EQInfoPage;
