jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

import React from 'react';
import ReactTestRenderer, {
  type ReactTestRenderer as TestRenderer,
} from 'react-test-renderer';
import App from '../App';

async function renderApp() {
  let renderer: TestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  if (!renderer) throw new Error('App did not render.');
  return renderer;
}

test('shows the logged-out welcome screen', async () => {
  const app = await renderApp();

  expect(
    app.root.findByProps({ testID: 'welcome-title' }).props.children,
  ).toBe('Welcome to LoFi Pix');
  expect(app.root.findByProps({ testID: 'sign-in-email' })).toBeTruthy();
  expect(app.root.findByProps({ testID: 'sign-in-password' })).toBeTruthy();
  expect(
    app.root.findByProps({ testID: 'sign-in-button' }).props.children.props
      .children,
  ).toBe('Sign in');
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

test('shows an inline message when sign-in is not configured', async () => {
  const app = await renderApp();

  await ReactTestRenderer.act(() => {
    app.root.findByProps({ testID: 'sign-in-email' }).props.onChangeText(
      'user@example.com',
    );
    app.root.findByProps({ testID: 'sign-in-password' }).props.onChangeText(
      'password',
    );
  });
  await ReactTestRenderer.act(() => {
    app.root.findByProps({ testID: 'sign-in-button' }).props.onPress();
  });

  expect(
    app.root.findByProps({ testID: 'auth-error' }).props.children,
  ).toBe('Sign-in is not connected yet.');
});
