jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../src/lib/auth', () => ({
  restoreAuthSession: jest.fn(),
  signInWithEmail: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('react-native-vision-camera', () => ({
  useCameraPermission: jest.fn(),
}));

import React from 'react';
import ReactTestRenderer, {
  type ReactTestRenderer as TestRenderer,
} from 'react-test-renderer';
import { useCameraPermission } from 'react-native-vision-camera';
import App from '../App';
import { restoreAuthSession, signInWithEmail, signOut } from '../src/lib/auth';

const mockRequestPermission = jest.fn<Promise<boolean>, []>();

async function renderApp() {
  let renderer: TestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  if (!renderer) throw new Error('App did not render.');
  return renderer;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(restoreAuthSession).mockResolvedValue(null);
  jest.mocked(signInWithEmail).mockResolvedValue({ email: 'user@example.com' });
  jest.mocked(signOut).mockResolvedValue(undefined);
  mockRequestPermission.mockResolvedValue(true);
  jest.mocked(useCameraPermission).mockReturnValue({
    status: 'not-determined',
    hasPermission: false,
    canRequestPermission: true,
    requestPermission: mockRequestPermission,
  });
});

test('shows the logged-out welcome screen', async () => {
  const app = await renderApp();

  expect(
    app.root.findByProps({ testID: 'welcome-title' }).props.children,
  ).toBe('Welcome to LoFi Pix');
  expect(app.root.findByProps({ testID: 'sign-in-email' })).toBeTruthy();
  expect(app.root.findByProps({ testID: 'sign-in-password' })).toBeTruthy();
});

test('shows required field errors inline', async () => {
  const app = await renderApp();

  await ReactTestRenderer.act(() => {
    app.root.findByProps({ testID: 'sign-in-button' }).props.onPress();
  });

  expect(
    app.root.findByProps({ testID: 'email-error' }).props.children,
  ).toBe('Enter your email address.');
  expect(
    app.root.findByProps({ testID: 'password-error' }).props.children,
  ).toBe('Enter your password.');
});

test('shows Better Auth sign-in errors inline', async () => {
  jest
    .mocked(signInWithEmail)
    .mockRejectedValue(new Error('Invalid email or password.'));
  const app = await renderApp();

  await ReactTestRenderer.act(() => {
    app.root.findByProps({ testID: 'sign-in-email' }).props.onChangeText(
      'user@example.com',
    );
    app.root.findByProps({ testID: 'sign-in-password' }).props.onChangeText(
      'password',
    );
  });
  await ReactTestRenderer.act(async () => {
    await app.root.findByProps({ testID: 'sign-in-button' }).props.onPress();
  });

  expect(
    app.root.findByProps({ testID: 'auth-error' }).props.children,
  ).toBe('Invalid email or password.');
});

test('shows the dashboard and requests camera access after sign-in', async () => {
  const app = await renderApp();

  await ReactTestRenderer.act(() => {
    app.root.findByProps({ testID: 'sign-in-email' }).props.onChangeText(
      'user@example.com',
    );
    app.root.findByProps({ testID: 'sign-in-password' }).props.onChangeText(
      'password',
    );
  });
  await ReactTestRenderer.act(async () => {
    await app.root.findByProps({ testID: 'sign-in-button' }).props.onPress();
  });

  expect(signInWithEmail).toHaveBeenCalledWith('user@example.com', 'password');
  expect(
    app.root.findByProps({ testID: 'dashboard-title' }).props.children,
  ).toBe('Welcome to LoFi Pix');
  expect(mockRequestPermission).toHaveBeenCalledTimes(1);
});

test('shows Settings and logs out to the welcome screen', async () => {
  const app = await renderApp();

  await ReactTestRenderer.act(() => {
    app.root.findByProps({ testID: 'sign-in-email' }).props.onChangeText(
      'user@example.com',
    );
    app.root.findByProps({ testID: 'sign-in-password' }).props.onChangeText(
      'password',
    );
  });
  await ReactTestRenderer.act(async () => {
    await app.root.findByProps({ testID: 'sign-in-button' }).props.onPress();
  });
  await ReactTestRenderer.act(() => {
    app.root.findByProps({ testID: 'dashboard-settings-button' }).props.onPress();
  });

  expect(
    app.root.findByProps({ testID: 'settings-title' }).props.children,
  ).toBe('Settings');
  expect(
    app.root.findByProps({ testID: 'settings-account-email' }).props.children,
  ).toBe('user@example.com');
  const logoutButton = app.root.findByProps({ testID: 'logout-button' });
  expect(logoutButton.props.style({ pressed: false })).toContainEqual(
    expect.objectContaining({ marginTop: 'auto' }),
  );

  await ReactTestRenderer.act(async () => {
    await app.root.findByProps({ testID: 'logout-button' }).props.onPress();
  });

  expect(signOut).toHaveBeenCalledTimes(1);
  expect(app.root.findByProps({ testID: 'welcome-title' })).toBeTruthy();
});
