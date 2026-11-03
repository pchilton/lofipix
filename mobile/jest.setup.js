/* eslint-env jest */

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    State: {},
    PanGestureHandler: View,
    BaseButton: View,
    RectButton: View,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(inset),
    SafeAreaView: require('react-native').View,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: { insets: inset, frame: { x: 0, y: 0, width: 390, height: 844 } },
  };
});

jest.mock('react-native-screens', () => {
  const actual = jest.requireActual('react-native-screens');
  return {
    ...actual,
    enableScreens: jest.fn(),
  };
});

jest.mock('@op-engineering/op-sqlite', () => {
  const rows = new Map();
  const db = {
    execute: jest.fn(async (query, params) => {
      if (String(query).toLowerCase().includes('select value from local_meta')) {
        return { rows: rows.has('schema_version') ? [{ value: rows.get('schema_version') }] : [] };
      }
      if (String(query).toLowerCase().includes("key = 'schema_version'")) {
        rows.set('schema_version', params?.[0]);
      }
      return { rows: [] };
    }),
    executeBatch: jest.fn(async () => ({ rows: [] })),
    transaction: jest.fn(async (fn) => fn(db)),
    close: jest.fn(),
    closeAsync: jest.fn(async () => {}),
    delete: jest.fn(),
  };
  return { open: jest.fn(() => db), openAsync: jest.fn(async () => db) };
});

jest.mock('react-native-file-access', () => ({
  Dirs: { DocumentDir: '/documents' },
  FileSystem: {
    exists: jest.fn(async () => false),
    mkdir: jest.fn(async (path) => path),
    readFile: jest.fn(async () => ''),
    writeFile: jest.fn(async () => {}),
    unlink: jest.fn(async () => {}),
    cp: jest.fn(async () => {}),
    mv: jest.fn(async () => {}),
    ls: jest.fn(async () => []),
    stat: jest.fn(async () => ({ size: 1024 })),
    hash: jest.fn(async () => 'abc123'),
  },
}));

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(async () => true),
  getGenericPassword: jest.fn(async () => false),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({ isConnected: true })),
  addEventListener: jest.fn(() => () => {}),
}));

jest.mock('react-native-camera-kit', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockCamera = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      capture: jest.fn(async () => ({
        uri: 'file:///tmp/photo.jpg',
        name: 'photo.jpg',
        width: 1920,
        height: 1080,
        size: 1024,
      })),
      requestDeviceCameraAuthorization: jest.fn(async () => true),
      checkDeviceCameraAuthorizationStatus: jest.fn(async () => true),
    }));
    return React.createElement(View, props);
  });
  return {
    __esModule: true,
    default: MockCamera,
    Camera: MockCamera,
    CameraType: { Front: 'front', Back: 'back' },
  };
});

jest.mock('@bam.tech/react-native-image-resizer', () => ({
  __esModule: true,
  default: {
    createResizedImage: jest.fn(async () => ({
      uri: '/documents/photos/photo.jpg',
      width: 1280,
      height: 720,
      size: 200_000,
    })),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stub = (props) => React.createElement(View, props);
  return { __esModule: true, default: Stub, Svg: Stub, SvgXml: Stub, Path: Stub, G: Stub, Circle: Stub, Rect: Stub };
});

jest.mock('@electric-sql/client', () => {
  const listeners = new Set();
  return {
    ShapeStream: jest.fn(() => ({
      subscribe: jest.fn((onMessages) => {
        listeners.add(onMessages);
        return () => listeners.delete(onMessages);
      }),
      unsubscribeAll: jest.fn(),
    })),
    isChangeMessage: () => false,
    isControlMessage: () => false,
    snakeCamelMapper: () => (value) => value,
    FetchError: class FetchError extends Error {
      constructor(message, status) {
        super(message);
        this.status = status;
      }
    },
  };
});
