import { BrowserRouter, Routes, Route } from "react-router-dom";

import NavBar from "./common/components/NavBarComponent/NavBarComponent";
import HomePage from './pages/HomePage/HomePage';
import LoginPage from './pages/LoginPage/LoginPage';

import './app.css';

const App = () => {
  return (
    <div>
      <NavBar headerTitle="CS•UPRI"/>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/home" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
