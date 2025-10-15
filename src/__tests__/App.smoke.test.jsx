import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import App from '../App';

// Minimal reducer to satisfy Provider
const reducer = (state = null) => state;

test('App mounts and shows loading screen initially', () => {
  const store = createStore(reducer);
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
  // Loading screen renders an SVG with aria-label="Loading"
  expect(screen.getByLabelText('Loading')).toBeInTheDocument();
});

