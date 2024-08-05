import React from 'react';
import Header from "./components/Header";
import EarthquakeInfo from './components/EarthquakeInfo';
import Sidebar from './components/sidebar';

function EQInfoPage() {
    return (
        <div className="App">
          <Header />
          <div className='body'>
            <Sidebar classname = 'left-sidebar'/>
            <EarthquakeInfo />
            <Sidebar classname = 'right-sidebar'/>
          </div>
        </div>
      );
}

export default EQInfoPage;