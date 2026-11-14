jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    API_URL: 'http://192.168.1.15:5634/',
    WEB_URL: 'http://192.168.1.15:5173/',
    POWERSYNC_URL: 'http://192.168.1.15:5677/',
  },
}));

import { mobileEnvironment } from '../src/config/environment';

test('exposes required endpoint configuration', () => {
  expect(mobileEnvironment).toEqual({
    API_URL: 'http://192.168.1.15:5634/',
    WEB_URL: 'http://192.168.1.15:5173/',
    POWERSYNC_URL: 'http://192.168.1.15:5677/',
  });
});
