import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Card from '../components/Card';
import './SignificantEQsPage.css';
import axios from 'axios';

/**
 * Significant Earthquakes list page. Renders a grid of cards loaded from backend
 * and navigates to detail page on card click.
 * @returns {JSX.Element}
 */
function SignificantEQsPage() {
  const [significantEQs, setSignificantEQs] = useState([]); // hook for list of device in table (array)success message
  const navigate = useNavigate(); // Initialize the navigate function

  useEffect(() => {
    fetchSignificantEQs();
  }, []);

  // Function for getting all significant earthquake list from backend
  const fetchSignificantEQs = async () => {
    try {
      // get significant-eqs from backend
      const backend_host =
        process.env.NODE_ENV === 'production'
          ? window['ENV'].REACT_APP_BACKEND
          : window['ENV'].REACT_APP_BACKEND_DEV;
      axios.defaults.withCredentials = true;
      const response = await axios.get(`${backend_host}/significant-eqs/all`);
      setSignificantEQs(response.data.payload);
    } catch (error) {
      // Handle any error that occurred during the request
      console.error('Error:', error.message);
    }
  };

  // Function for transitioning to another page on card click
  const handleCardClick = (id) => {
    navigate(`/significant-eq-info?id=${id}`);
  };

  return (
    <div className="App">
      {/* dev log removed */}
      <Header />
      <div className="App-body">
        <div className="content-container">
          <h1>Significant Earthquakes</h1>
          <div className="cards-container">
            {significantEQs.map((card, index) => (
              <Card
                key={index}
                title={card.title}
                magnitude={card.magnitude}
                location={card.location}
                date={card.date}
                time={card.time}
                description={card.eventSummary}
                onClick={() => handleCardClick(card._id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignificantEQsPage;
