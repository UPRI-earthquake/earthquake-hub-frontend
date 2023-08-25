import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import styles from "./Dashboard.module.css";
import ErrorPopup from "./ErrorPopup";
import Toast from "./Toast";

const statusTooltips = {
  'Not Yet Linked': 'Access your raspberry shake device to link it to your e-hub account.',
  'Not Streaming': 'This device has been linked to your account but is currently not sending data to the server.',
  'Streaming': 'This device is sending data to the server.',
};

function Dashboard({ onClick, onEscapeClick, onSignoutSuccess, loggedInUserRole }) {
  const [pageTransition, setPageTransition] = useState(0); // controls dashboard transition from pageX to profile or vice-versa
  const [errorMessage, setErrorMessage] = useState('') // hook for all error message
  const [devices, setDevices] = useState([]) // hook for list of device in table (array)success message
  const [brgyAccessToken, setBrgyAccessToken] = useState() // hook for brgyAccessToken
  const addDeviceFormRef = useRef(null);
  const dashboardContainerRef = useRef(null);
  const profileRef = useRef(null);

  // TOASTS
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  useEffect(() => {
    fetchDevices();
  }, [])

  const fetchDevices = async () => {
    try {
      const backend_host = process.env.NODE_ENV === 'production'
        ? window['ENV'].REACT_APP_BACKEND
        : window['ENV'].REACT_APP_BACKEND_DEV
      axios.defaults.withCredentials = true;
      const response = await axios.get(`${backend_host}/device/my-devices`);
      setDevices(response.data.devices)
    } catch (error) {
      // Handle any error that occurred during the request
      console.error('Error:', error.message);
    }
  }

  useEffect(() => {
    const dashboardContainerEl = dashboardContainerRef.current;
    dashboardContainerEl.animate(
      [
        { opacity: 0, transform: 'translateX(100%)' },
        { opacity: 1, transform: 'translateX(0)' }
      ],
      {
        duration: 150,
        easing: 'cubic-bezier(0, 0, 0.5, 1)',
        fill: 'both'
      }
    );

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onEscapeClick();
      }
    };
  
    document.addEventListener('keydown', handleKeyDown);
  
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onEscapeClick]);

  useEffect(() => {
    switch (pageTransition) {
      case 0: // Initial state
        profileRef.current.animate(
          [
            { opacity: 0, transform: 'translateX(100%)' },
            { opacity: 1, transform: 'translateX(0)' }
          ],
          {
            duration: 150,
            easing: 'cubic-bezier(0, 0, 0.5, 1)',
            fill: 'both'
          }
        );
        break;

      case 1: // Other to DeviceList (where Other is any other dashboard view, and DeviceList/Profile is the main view)
        profileRef.current.animate(
          [
            { opacity: 0, transform: 'translateX(-100%)' },
            { opacity: 1, transform: 'translateX(0)' }
          ],
          {
            duration: 300,
            easing: 'cubic-bezier(0, 0, 0.5, 1)',
            fill: 'both'
          }
        );
        break;

      case 2: // DeviceList to AddDevice
        addDeviceFormRef.current.animate(
          [
            { opacity: 0, transform: 'translateX(100%)' }, // Updated transform property
            { opacity: 1, transform: 'translateX(0%)' } // Updated transform property
          ],
          {
            duration: 300,
            easing: 'cubic-bezier(0, 0, 0.5, 1)',
            fill: 'both'
          }
        );
        break;

      default:
        console.error(`pageTransition of value ${pageTransition} not handled!`);
    }
  }, [pageTransition]);

  async function handleAddDeviceSubmit(event) {
    event.preventDefault();
    const backend_host = process.env.NODE_ENV === 'production'
                       ? window['ENV'].REACT_APP_BACKEND
                       : window['ENV'].REACT_APP_BACKEND_DEV

    const network = event.target.elements.network.value;
    const station = event.target.elements.station.value;
    const longitude = event.target.elements.longitude.value;
    const latitude = event.target.elements.latitude.value;
    const elevation = event.target.elements.elevation.value;
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(
        `${backend_host}/device/add`,
        {
          network: network,
          station: station,
          longitude: longitude,
          latitude: latitude,
          elevation: elevation
        }
      );
      console.log("Add Device Success", response.data);
      
      // Set toast message
      setToastMessage('Device added. Visit rs.local:3000 to link device.');
      setToastType('success');

      // Set toast message to empty string to remove the toast
      setTimeout(() => {
        setToastMessage('');
      }, 5000);
      /*
      setIsAddingDevice(false); // set isAddingDevice hook to false
      setIsAddDeviceSuccess(true); // set isAddDeviceSuccess hook to true, to trigger transition
      */
      setPageTransition(1);
      fetchDevices(); // call fetchDevices() to update the device list table (should reload the table content with the successfully added device)
    } catch (error) {
        if (error.response) {
          const { data } = error.response;
          setToastMessage(`Error: ${data.message}`);
          setToastType('error');
          // Set toast message to empty string to remove the toast
          setTimeout(() => {
            setToastMessage('');
          }, 5000);

          console.error("Error occurred while adding device:", data);
        } else {
          setToastMessage(`Network Error`);
          setToastType('error');
          // Set toast message to empty string to remove the toast
          setTimeout(() => {
            setToastMessage('');
          }, 5000);

          console.error("Error occurred while adding device:", error);
        }
    }
  }

  async function requestTokenSubmit(event) {
    event.preventDefault();
    const backend_host = process.env.NODE_ENV === 'production'
      ? process.env.REACT_APP_BACKEND
      : process.env.REACT_APP_BACKEND_DEV
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backend_host}/accounts/acquire-brgy-token`);
      console.log('Brgy access token acquired', response.data)

      setBrgyAccessToken(response.data.accessToken)

      setToastMessage('Brgy access token request success');
      setToastType('success');
    } catch (error) {
      console.log(error)

      setToastMessage(`Brgy access token request error`);
      setToastType('error');
    }

    // Set toast message to empty string to remove the toast
    setTimeout(() => {
      setToastMessage('');
    }, 5000);
  }

  const textRef = useRef(null);

  function copyText() {
    try {
      if (!textRef.current.innerText) {
        throw new Error('Clipboard is empty. Request a token first.')
      }

      const textToCopy = textRef.current.innerText;
      navigator.clipboard.writeText(textToCopy)
      console.log("Text copied to clipboard:", textToCopy);

      setToastMessage('Access Token copied to clipboard');
      setToastType('success');
    } catch (error) {
      console.error("Failed to copy text:", error);

      setToastMessage('Failed to copy text');
      setToastType('error');
    }

    setTimeout(() => {
      setToastMessage('');
    }, 5000);
  }

  function handleAddDeviceClick() {
    setPageTransition(2);
  }

  function handleCancelClick() {
    setPageTransition(1);
    setErrorMessage('')
  }

  async function handleSignout() {
    const backend_host = process.env.NODE_ENV === 'production'
      ? window['ENV'].REACT_APP_BACKEND
      : window['ENV'].REACT_APP_BACKEND_DEV
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backend_host}/accounts/signout`);
      console.log('Sign out successful', response.data)

      onSignoutSuccess();
    } catch (error) {
      console.log(error)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClick}>
      <div ref={dashboardContainerRef} className={`${styles.dashboardModal}`} onClick={(e) => e.stopPropagation()}>
        <Toast message={toastMessage} toastType={toastType}></Toast>

        {(pageTransition < 2) && (
          <div ref={profileRef} className={styles.profileContainer}>
            <p className={styles.signoutButtonDiv}><span className={styles.signoutButton} onClick={handleSignout}>Sign out</span></p>
            <div className={styles.panelHeader}>
              <p>Profile</p>
            </div> {/* End of Profile panelHeader */}
            <div className={styles.panelBody}>
              
              {/* TODO: Will Add Profile Details Here */}
              {(loggedInUserRole === 'brgy') && (
              <>
                <div>
                  {(brgyAccessToken) && (<p className={styles.copyTextDiv}>
                    <span className={styles.copyTextButton} onClick={copyText}>
                      Copy to clipboard
                    </span>
                  </p>)}
                  <p className={styles.accessTokenContainer} ref={textRef}>{brgyAccessToken}</p>
                  {(brgyAccessToken) && (<small><i>Note: Please ensure to store this token, as we do not save a copy of your access token.</i></small>)}
                </div>

                <div className={styles.buttonDiv}>
                  <button onClick={requestTokenSubmit}>Request a Brgy Token</button>
                </div>
              </>
              )}

            </div> {/* End of Profile panelBody */}

            <div className={styles.panelHeader}>
              <p>Device List</p>
            </div> {/* End of Device List panelHeader */}
            <div className={styles.panelBody}>
              <div className={styles.deviceListTableContainer}>
                <table className={styles.deviceListTable}>
                  <thead>
                    <tr>
                      <th>Network</th>
                      <th>Station</th>
                      <th>Status</th>
                      <th>Status Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.length === 0 ? (
                      <tr>
                        <td colSpan="3">No data available</td>
                      </tr>
                    ) : (
                      devices.map((device, index) => (
                        <tr key={index}>
                          <td>{device.network}</td>
                          <td>{device.station}</td>
                          <td data-tooltip={statusTooltips[device.status]}>{device.status}</td>
                          <td>{device.statusSince}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.buttonDiv}>
                <button onClick={handleAddDeviceClick}>Add New Device</button>
              </div>
            </div> {/* End of Device List panelBody */}

          </div>
        )}

        {(pageTransition === 2) && (

        <>
          <div className={styles.panelHeader}>
            <p>Add New Device</p>
          </div> {/* End of Device List panelHeader */}
          <div className={styles.panelBody}>
            <form className={styles.addDeviceForm}
              ref={addDeviceFormRef} onSubmit={handleAddDeviceSubmit}>
              <div className={styles.inputField}>
                <input type="text" name="network" title="(e.g. `AM`)" placeholder='' />
                <label className={styles.inputLabel}>Network: (e.g. `AM`)</label>
              </div>
              <div className={styles.inputField} title="(e.g. `R3B2D`)">
                <input type="text" name="station" placeholder='' />
                <label className={styles.inputLabel}>Station: (e.g. `R3B2D`)</label>
              </div>
              <div className={styles.inputField}>
                <input type="text" name="elevation" title="in meters; relative to sea level (e.g. `1.232314`)" placeholder='' />
                <label className={styles.inputLabel}>Elevation: (in meters; relative to sea level. e.g. `1.232314`)</label>
              </div>
              <div className={styles.inputField}>
                <input type="text" name="latitude" title="in degree coordinates (e.g. `10.1234`)" placeholder='' />
                <label className={styles.inputLabel}>Latitude: (in degree coordinates. Range is from -90 to 90. e.g. `10.1234`)</label>
              </div>
              <div className={styles.inputField}>
                <input type="text" name="longitude" title="in degree coordinates (e.g. `0.1234`)" placeholder='' />
                <label className={styles.inputLabel}>Longitude: (in degree coordinates. Range is from -180 to 180. e.g. `0.1234`)</label>
              </div>
              <div className={styles.buttonDiv}>
                <button type="submit">Submit</button>
                <button type="button" className={styles.cancelButton} onClick={handleCancelClick}>Cancel</button>
              </div>
            </form>
          </div>
          {/* Error Message */}
          {(errorMessage.length > 0) && <ErrorPopup message={errorMessage} />}
        </>
        )}

      </div>
    </div>
  );
}

export { Dashboard };
