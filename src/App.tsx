import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoadingScreen from './shared/ui/components/LoadingScreen';
import ConsentBanner from './shared/ui/components/ConsentBanner';
import EarthquakeDetailsPage from './pages/EarthquakeDetailsPage';
import MapPage from './pages/MapPage';
import { AuthProvider } from './shared/services/account/context';

// Lazy-load heavy routes to improve initial load
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/**
 * Root application router and top-level layout. Routes are split to reduce
 * initial bundle size without changing user-visible behavior.
 * @returns {JSX.Element}
 */
function App() {
  return (
    <div className="App">
      <AuthProvider>
        <ConsentBanner />
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<MapPage />} />
              <Route path="/earthquake-detail" element={<EarthquakeDetailsPage />} />{/* Earthquake detail page route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </div>
  );
}

export default App;
