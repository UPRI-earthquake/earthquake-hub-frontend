import React from 'react';
import './EarthquakeInfo.css';
import DownloadButtons from './DownloadButton';
import StationDownloadButtons from './StationDownloadButton';
import Articles from './Articles'
import BackIcon from './BackIcon'; // Adjust the path as needed


const EarthquakeInfo = () => {
  return (
    <>
    <div className="earthquake-info-container">
      <main className="main-content">
      <BackIcon />
          <div className="info-details">
            <div class="table-container">
              <table className="info-table">
                    <tbody>
                      <tr>
                        <th colSpan={3}>
                          <h2>M7.1 earthquake hits Davao Occidental</h2>
                        </th>
                      </tr>
                      <tr>
                        <td className="first-column ">Date & Time:</td>
                        <td className="value">Jan 23, 2023</td>
                      </tr>
                      <tr>
                        <td className="first-column ">Location:</td>
                        <td className="value">13.66°N, 120.57°E - 021 km S 20° W of Davao Occidental</td>
                      </tr>
                      <tr>
                        <td className="first-column ">Magnitude:</td>
                        <td className="value">7.1</td>
                      </tr>
                      <tr className='instrument'>
                        <td className="first-column">
                          Instrument Recordings:
                        </td>
                        <td className="value">
                          <ul className="station">
                            <li>
                              <div className="list-items">
                                <p>R2DSF</p>
                                <StationDownloadButtons stationCode="R2DSF" />
                              </div>
                            </li>
                            <li>
                              <div className="list-items">
                                <p>RF3GH</p>
                                <StationDownloadButtons stationCode="RF3GH" />
                              </div>
                            </li>
                            <li>
                              <div className="list-items">
                                <p>R2DKF</p>
                                <StationDownloadButtons stationCode="R2DKF" />
                              </div>
                            </li>
                          </ul>
                        </td>
                        <td>
                          <DownloadButtons />
                        </td>
                      </tr>
                      <tr>
                        <td className="first-column ">Event Summary:</td>
                        <td className="value" colSpan={2}>
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                        </td>
                      </tr>
                    </tbody>
              </table>
            </div>
            <h2>Reports:</h2>
            <div className='reference'>
              <Articles url = 'https://www.rappler.com/philippines/earthquake-davao-del-sur-february-7-2021/'/>
              <Articles url = 'https://www.philstar.com/headlines/2021/02/07/2075988/no-official-damage-casualty-yet-63-quake-davao-del-sur' />
              <Articles url = 'https://www.gmanetwork.com/news/scitech/science/774933/magnitude-6-3-earthquake-hits-davao-del-sur/story/' />
              {/* <Articles url = 'https://earthquake.phivolcs.dost.gov.ph/2024_Earthquake_Information/July/2024_0711_0213_B4F.html' /> */}
              <Articles url = 'https://monitoring-dashboard.ndrrmc.gov.ph/page/situation/situational-report-for-magnitude-70-earthquake-in-tayum-abra-2022' />
            </div>
          </div>
      </main>
    </div>
    </>
  );
};

export default EarthquakeInfo;
