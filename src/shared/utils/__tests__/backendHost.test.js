import { getBackendHost, normalizeBackendHost } from '../../utils/backendHost';

describe('backendHost utils', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBackend = process.env.REACT_APP_BACKEND;
  const originalBackendDev = process.env.REACT_APP_BACKEND_DEV;
  const originalWindowEnv = window.ENV;

  beforeEach(() => {
    delete process.env.REACT_APP_BACKEND;
    delete process.env.REACT_APP_BACKEND_DEV;
    delete window.ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.REACT_APP_BACKEND = originalBackend;
    process.env.REACT_APP_BACKEND_DEV = originalBackendDev;
    if (originalWindowEnv === undefined) {
      delete window.ENV;
    } else {
      window.ENV = originalWindowEnv;
    }
  });

  test('normalizes trailing slashes and whitespace', () => {
    expect(normalizeBackendHost(' https://api.example.com/// ')).toBe('https://api.example.com');
  });

  test('prefers runtime production host and strips trailing slash', () => {
    process.env.NODE_ENV = 'production';
    window.ENV = {
      REACT_APP_BACKEND: ' https://runtime.example.com/api/ ',
    };
    process.env.REACT_APP_BACKEND = 'https://build.example.com/api/';

    expect(getBackendHost()).toBe('https://runtime.example.com/api');
  });

  test('falls back to primary backend in development when dev host is missing', () => {
    process.env.NODE_ENV = 'development';
    window.ENV = {
      REACT_APP_BACKEND: 'https://runtime.example.com/api/',
    };

    expect(getBackendHost()).toBe('https://runtime.example.com/api');
  });

  test('falls back to build-time env values when runtime env is unavailable', () => {
    process.env.NODE_ENV = 'development';
    process.env.REACT_APP_BACKEND_DEV = ' https://build-dev.example.com/api// ';

    expect(getBackendHost()).toBe('https://build-dev.example.com/api');
  });
});
