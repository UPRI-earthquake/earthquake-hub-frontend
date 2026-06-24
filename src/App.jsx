import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoadingScreen from './components/LoadingScreen';
import ConsentBanner from './components/ConsentBanner';
import OldDomainMigrationNotice from './components/OldDomainMigrationNotice';
import EarthquakeDetailPage from './pages/EarthquakeDetailPage';

// Lazy-load heavy routes to improve initial load
const SignificantEQsPage = lazy(() => import('./pages/SignificantEQsPage'));
const EQInfoPage = lazy(() => import('./pages/EQInfoPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/**
 * Root application router and top-level layout. Routes are split to reduce
 * initial bundle size without changing user-visible behavior.
 * @returns {JSX.Element}
 */
function App() {
  return (
    <div className="App">
      <OldDomainMigrationNotice />
      <ConsentBanner />
      <Router>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" exact element={<HomePage />} />
            <Route path="/significant-eqs" element={<SignificantEQsPage />} />
            <Route path="/significant-eq-info" element={<EQInfoPage />} />
            <Route path="/earthquake-detail" element={<EarthquakeDetailPage />} />{/* Earthquake detail page route */}
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Router>
    </div>
  );
}

export default App;
