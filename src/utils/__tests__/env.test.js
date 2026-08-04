import { getEnv, ringserverWS } from '../env';

describe('runtime environment helpers', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWindowEnv = window.ENV;

  beforeEach(() => {
    delete window.ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalWindowEnv === undefined) {
      delete window.ENV;
    } else {
      window.ENV = originalWindowEnv;
    }
  });

  test('reads values from the runtime environment', () => {
    window.ENV = { EXAMPLE_VALUE: 'configured' };

    expect(getEnv('EXAMPLE_VALUE')).toBe('configured');
    expect(getEnv('MISSING_VALUE')).toBe('');
  });

  test('uses the production Ringserver URL in production builds', () => {
    process.env.NODE_ENV = 'production';
    window.ENV = {
      REACT_APP_RINGSERVER_WS: 'wss://example.com/ringserver/datalink',
      REACT_APP_RINGSERVER_WS_DEV: 'ws://localhost:16000/datalink',
    };

    expect(ringserverWS()).toBe('wss://example.com/ringserver/datalink');
  });

  test('uses the development Ringserver URL in development builds', () => {
    process.env.NODE_ENV = 'development';
    window.ENV = {
      REACT_APP_RINGSERVER_WS: 'wss://example.com/ringserver/datalink',
      REACT_APP_RINGSERVER_WS_DEV: 'ws://localhost:16000/datalink',
    };

    expect(ringserverWS()).toBe('ws://localhost:16000/datalink');
  });
});
