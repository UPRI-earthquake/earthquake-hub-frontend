import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../App';

vi.mock('../pages/MapPage', () => ({ default: () => null }));
vi.mock('../pages/EarthquakeDetailsPage', () => ({ default: () => null }));
vi.mock('@/shared/services/account/data', () => ({
  default: () => ({ data: null, isLoading: false }),
}));

test('App shows the loading screen while the fallback route loads', async () => {
  const originalPath = window.location.href;
  window.history.replaceState(null, '', '/missing-page');
  try {
    render(<App />);
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
    expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
  } finally {
    window.history.replaceState(null, '', originalPath);
  }
});

