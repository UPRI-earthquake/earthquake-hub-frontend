import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import styles from "./Dashboard.module.css";
import ErrorPopup from "./ErrorPopup";

const statusTooltips = {
  'Not Yet Linked': 'Access your raspberry shake device to link it to your e-hub account.',
  'Not Streaming': 'This device has been linked to your account but is currently not sending data to the server.',
  'Streaming': 'This device is sending data to the server.',
};

function Dashboard({ onClick, onEscapeClick, signupSuccessMessage, onPopupExit, onLogout }) {
  const [pageTransition, setPageTransition] = useState(0); // controls dashboard transition from pageX to profile or vice-versa
  const [errorMessage, setErrorMessage] = useState('') // hook for all error message
  const [devices, setDevices] = useState([]) // hook for list of device in table (array)
  const [SignupSuccessMessage, setSignupSuccessMessage] = useState(signupSuccessMessage); // hook for success message on successful registration
  const [addDeviceSuccessMessage, setAddDeviceSuccessMessage] = useState();  // hook for add device success message
  const addDeviceFormRef = useRef(null);
  const dashboardContainerRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    fetchDevices();
  }, [])

  const fetchDevices = async () => {
    try {
      const backend_host = process.env.NODE_ENV === 'production'
        ? process.env.REACT_APP_BACKEND
        : process.env.REACT_APP_BACKEND_DEV
      const accessToken = localStorage.getItem('accessToken');
      const axiosConfig = {
        headers: {
          'content-Type': 'application/json',
          "Accept": "/",
          "Cache-Control": "no-cache",
          "Cookie": `accessToken=${accessToken}`
        },
        withCredentials: true
      };
      const response = await axios.get(`${backend_host}/device/list`, axiosConfig);
      setDevices(response.data.payload)
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
                       ? process.env.REACT_APP_BACKEND
                       : process.env.REACT_APP_BACKEND_DEV

    const network = event.target.elements.network.value;
    const station = event.target.elements.station.value;
    const location = event.target.elements.location.value;
    const elevation = event.target.elements.elevation.value;
    const accessToken = localStorage.getItem('accessToken');
    try {
      const axiosConfig = {
        headers: {
          'content-Type': 'application/json',
          "Accept": "/",
          "Cache-Control": "no-cache",
          "Cookie": `accessToken=${accessToken}`
        },
        credentials: "same-origin"
      };
      axios.defaults.withCredentials = true;
      const response = await axios.post(
        `${backend_host}/device/add`,
        {
          network: network,
          station: station,
          location: location,
          elevation: elevation
        }, axiosConfig
      );
      console.log("Add Device Success", response.data);

      setAddDeviceSuccessMessage('Successfully added a new device. Your next step is to link your rshake device to your account. Access the device-to-account linking page of your device by going to rs-upri.local.') // Set success message to be displayed, in toast, after successful add device
      /*
      setIsAddingDevice(false); // set isAddingDevice hook to false
      setIsAddDeviceSuccess(true); // set isAddDeviceSuccess hook to true, to trigger transition
      */
      setPageTransition(1);
      fetchDevices(); // call fetchDevices() to update the device list table (should reload the table content with the successfully added device)
    } catch (error) {
        if (error.response) {
          const { data } = error.response;
          setErrorMessage(`Error: ${data.message}`); // API should always sends {message: ""} in json
          console.error("Error occurred while adding device:", data);
        } else {
          setErrorMessage("Network Error")
          console.error("Error occurred while adding device:", error);
        }
    }
  }

  function handleAddDeviceClick() {
    setPageTransition(2);
  }

  function handleCancelClick() {
    setPageTransition(1);
    setErrorMessage('')
  }

  function handleExitPopup() {
    setSignupSuccessMessage('')
    onPopupExit()
  }

  function handlePopupClose() {
    setAddDeviceSuccessMessage('')
  }

  async function handleLogout() {
    const backend_host = process.env.NODE_ENV === 'production'
      ? process.env.REACT_APP_BACKEND
      : process.env.REACT_APP_BACKEND_DEV
    const accessToken = localStorage.getItem('accessToken');
    try {
      const axiosConfig = {
        headers: {
          'content-Type': 'application/json',
          "Accept": "/",
          "Cache-Control": "no-cache",
          "Cookie": `accessToken=${accessToken}`
        },
        credentials: "same-origin"
      };
      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backend_host}/accounts/logout`,{}, axiosConfig);
      console.log(response)

      onLogout();
    } catch (error) {
      console.log(error)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClick}>
      <div ref={dashboardContainerRef} className={`${styles.dashboardModal}`} onClick={(e) => e.stopPropagation()}>
        <button onClick={handleLogout}>Logout</button>

        {(pageTransition < 2) && (
          <div ref={profileRef} className={`${styles.profileContainer}`}>
          {SignupSuccessMessage && (
            <div className={styles.messagePopup}>
              <button className={styles.exitButton} onClick={handleExitPopup}>
                X
              </button>
              <p>{SignupSuccessMessage}</p>
            </div>
          )} 
          <h2>Profile</h2>
            {/* TODO: Will Add Profile Details Here */}

          <h2>Device List</h2>
          {addDeviceSuccessMessage && (
            <div className={styles.messagePopup}>
              <button className={styles.exitButton} onClick={handlePopupClose}>
                X
              </button>
              <p>{addDeviceSuccessMessage}</p>
            </div>
          )} 
          <div className={styles.deviceListTableContainer}>
          <table className={styles.deviceListTable}>
            <thead>
              <tr>
                <th>Network</th>
                <th>Station</th>
                <th>Status</th>
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
                      </tr>
                    ))
                  )}
                </tbody>
          </table>
          </div>

          <div className={styles.addDeviceButtonDiv}>
            <button className={styles.addDeviceButton} onClick={handleAddDeviceClick}>Add Device</button>
          </div>
          </div>
        )}

        {(pageTransition === 2) && (

        <>
          <form className={`${styles.addDeviceForm} ${styles.addDeviceForm_default}`}
                ref={addDeviceFormRef} onSubmit={handleAddDeviceSubmit}>
            <h2>Add New Device</h2>
            {/* Add device form contents */}
              <input type="text" name="network" placeholder="Network" />
              <input type="text" name="station" placeholder="Station" />
              <input type="text" name="elevation" placeholder="Elevation" />
              <input type="text" name="location" placeholder="Location" />
            <div className={styles.addDeviceButtonDiv}>
              <button type="submit"  className={styles.addDeviceButton}>Submit</button>
              <button type="button" className={styles.cancelButton} onClick={handleCancelClick}>Cancel</button>
            </div>
          </form>
          {/* Error Message */}
          {(errorMessage.length > 0) && <ErrorPopup message={errorMessage} />}
        </>
        )}

      </div>
    </div>
  );
}

export { Dashboard };
