import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SignificantEQsPage from "./pages/SignificantEQsPage";
import EQInfoPage from "./pages/EQInfoPage";

function App() {
  return(
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" exact element={ <HomePage/>} />
          <Route path="/significant-eqs" element={ <SignificantEQsPage/>} />
          <Route path="/significant-eq-info" element={ <EQInfoPage/>} />
        </Routes>
      </Router>

    </div>
  );
}

export default App;