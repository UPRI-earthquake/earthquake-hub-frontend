import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import styles from "./Dashboard.module.css";
// import ErrorPopup from "./ErrorPopup";

function DashboardModal({ children, title, onClick, onSubmit, onEscapeClick }) {
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

  const handleSubmit = (event) => {
    // call onSubmit instead of prevent form-submit behavior of sending
    // a basic request to the server to handle the data, making the server
    // navigate to a new page
    event.preventDefault();
    onSubmit(event);
  };

  // const handleExitClick = () => {
  //   const profileEl = profileRef.current;
  //   profileEl.classList.add(styles.hidden);
  //   profileEl.classList.remove(styles.profileModal);
  //   profileEl.classList.remove(styles.profileForm);
  //   profileEl.animate(
  //     [
  //       { opacity: 1, transform: 'translateX(0)' },
  //       { opacity: 0, transform: 'translateX(100%)' }
  //     ],
  //     {
  //       duration: 150,
  //       easing: 'cubic-bezier(0, 0, 0.5, 1)'
  //     }
  //   )
  // };

  return (
    <div className={styles.profileModal} onClick={onClick}>
      {/*When .form div is clicked, prevent click event from bubbling up
         to the div above so that it will not exec it's onClick handler (which
         should close the modal*/}
      <div ref={profileRef} className={`${styles.profileForm} ${styles.hidden}`} onClick={(e) => e.stopPropagation()}>
        {/* <div className={styles.exitButton} onClick={handleExitClick}>
          X
        </div> */}
        <form onSubmit={handleSubmit}>
          <h2>{title}</h2>
          {children}
        </form>
      </div>
    </div>
  );
}


function Dashboard({ onClick, onEscapeClick }) {
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [errorMessage, setErrorMessage] = useState("")
  const addDeviceFormRef = useRef(null);
  const profileContainerRef = useRef(null);

  useEffect(() => {
    if (isAddingDevice) {
      const addDeviceFormEl = addDeviceFormRef.current;
      addDeviceFormEl.classList.add(styles.showForm);
    } else{
      const profileContainerEl = profileContainerRef.current;
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
          console.error("Error occurred while adding device:", error);
        }
    }
  }

  function handleAddDeviceClick() {
    setIsAddingDevice(true);
    setErrorMessage("")
  }

  function handleCancelClick() {
    setIsAddingDevice(false);
  }

  return (
    <DashboardModal onClick={onClick} onEscapeClick={onEscapeClick} onSubmit={handleAddDeviceSubmit}>
      {isAddingDevice ? (
        <div className={styles.addDeviceForm} ref={addDeviceFormRef}>
            <h2>Add a New Device</h2>
            {/* Error Message Div*/}
            {errorMessage && (
              <div className={styles.errorPopup}>
                <p>{errorMessage}</p>
              </div>
            )}
            {/* Add device form contents */}
            <label>
              Network
              <input type="text" name="network" />
            </label>
            <label>
              Station
              <input type="text" name="station" />
            </label>
            <label>
              Elevation
              <input type="text" name="elevation" />
            </label>
            <label>
              Location
              <input type="text" name="location" />
            </label>
            <button type="submit">Submit</button>
            <button type="button" onClick={handleCancelClick}>Cancel</button>
        </div>
      ) : (
        <div ref={profileContainerRef}>
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

          <div className={styles.addButtonContainer}>
            <button onClick={handleAddDeviceClick}>Add Device</button>
          </div>
        </div>
      )}

    </DashboardModal>
  );
}

export { Dashboard };