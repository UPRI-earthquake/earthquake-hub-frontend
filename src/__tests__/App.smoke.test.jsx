import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import axios from 'axios';
import App from '../App';

jest.mock('axios', () => ({
  defaults: {},
  get: jest.fn(),
}));

beforeEach(() => {
  // This smoke test asserts the initial loading boundary only. Keep network
  // requests pending so later application state is outside the test's scope.
  axios.get.mockImplementation(() => new Promise(() => {}));
});

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
