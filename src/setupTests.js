// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Keep tests isolated from live backend calls and avoid axios's ESM entrypoint
// tripping CRA's Jest transform pipeline.
jest.mock('axios', () => {
  const client = {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    patch: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    head: jest.fn(() => Promise.resolve({ data: {} })),
    isCancel: jest.fn(() => false),
    defaults: {},
  };

  return {
    __esModule: true,
    default: client,
    ...client,
    create: jest.fn(() => client),
  };
});
