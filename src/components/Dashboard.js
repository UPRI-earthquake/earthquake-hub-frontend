import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import styles from "./Dashboard.module.css";
import ErrorPopup from "./ErrorPopup";

function Dashboard({ onClick, onEscapeClick, signupSuccessMessage, onPopupExit }) {
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [errorMessage, setErrorMessage] = useState('')
  const [SignupSuccessMessage, setSignupSuccessMessage] = useState(signupSuccessMessage);
  const addDeviceFormRef = useRef(null);
  const dashboardContainerRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const profileEl = profileRef.current;
    profileEl.classList.remove(styles.hidden);
    profileEl.animate(
      [
        { opacity: 0, transform: 'translateX(100%)' }, // Updated transform property
        { opacity: 1, transform: 'translateX(0)' } // Updated transform property
      ],
      {
        duration: 150,
        easing: 'cubic-bezier(0, 0, 0.5, 1)'
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
    if (isAddingDevice) {
      const addDeviceFormEl = addDeviceFormRef.current;
      addDeviceFormEl.classList.add(styles.showForm);
    } else{
      const profileContainerEl = dashboardContainerRef.current;
      profileContainerEl.classList.add(styles.showProfileContainer)
      profileContainerEl.classList.add(styles.animate);
    }
  }, [isAddingDevice]);

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
    setIsAddingDevice(true);
    setErrorMessage('')
  }

  function handleCancelClick() {
    setIsAddingDevice(false);
  }

  function handleExitPopup() {
    setSignupSuccessMessage('')
    onPopupExit()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClick}>
      <div ref={profileRef} className={`${styles.dashboardModal} ${styles.hidden}`} onClick={(e) => e.stopPropagation()}>
      {isAddingDevice ? (
        <>
          <form className={`${styles.addDeviceForm} ${styles.addDeviceForm_default}`} ref={addDeviceFormRef} onSubmit={handleAddDeviceSubmit}>
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
      ) : (
        <div ref={dashboardContainerRef}>
          {SignupSuccessMessage && (
            <div className={styles.messagePopup}>
              <button className={styles.exitButton} onClick={handleExitPopup}>
                X
              </button>
              <p>{SignupSuccessMessage}</p>
            </div>
          )} 
          <h2>Profile</h2>


          <h2>Device List</h2>
          <table className={styles.deviceListTable}>
            <thead>
              <tr>
                <th>Network</th>
                <th>Station</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>AM</td>
                <td>R3B2D</td>
                <td>Not Yet Linked</td>
              </tr>
              {/* Add more rows as needed */}
            </tbody>
          </table>

          <div className={styles.addDeviceButtonDiv}>
            <button className={styles.addDeviceButton} onClick={handleAddDeviceClick}>Add Device</button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}


// function AddDeviceForm() {

//   return (
//     <>
//       <h2>Add a New Device</h2>
//       {/* Error Message form*/}
//       {(errorMessage.length > 0) && <ErrorPopup message={errorMessage} />}
//       {/* Add device form contents */}
//       <label>
//         Network
//         <input type="text" name="network" />
//       </label>
//       <label>
//         Station
//         <input type="text" name="station" />
//       </label>
//       <label>
//         Elevation
//         <input type="text" name="elevation" />
//       </label>
//       <label>
//         Location
//         <input type="text" name="location" />
//       </label>
//       <button type="submit" className={styles.addDeviceButton}>Submit</button>
//       <button type="button" className={styles.cancelButton} onClick={handleCancelClick}>Cancel</button>
//     </>
//   );
// }


export { Dashboard };