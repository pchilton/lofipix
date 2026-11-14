type SignInRequest = {
  email: string;
  password: string;
  fetchOptions: {
    onSuccess: (context: {
      response: {
        headers: {
          get: (name: string) => string | null;
        };
      };
    }) => void;
  };
};

type SignInResponse = {
  data: unknown;
  error: { message: string } | null;
};

jest.mock('better-auth/react', () => {
  const email = jest.fn();
  const signOut = jest.fn();
  const authClientConfig = { current: null as unknown };
  const createAuthClient = jest.fn((options: unknown) => {
    authClientConfig.current = options;
    return { signIn: { email }, signOut };
  });
  return {
    __esModule: true,
    mockAuthClientConfig: authClientConfig,
    mockSignInEmail: email,
    mockSignOut: signOut,
    createAuthClient,
  };
});
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
  },
  STORAGE_TYPE: {
    AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth',
  },
  getGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
}));
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    API_URL: 'https://api.example.test/',
    WEB_URL: 'https://www.example.test/',
    POWERSYNC_URL: 'https://api.example.test/powersync/',
  },
}));

import * as BetterAuthReact from 'better-auth/react';
import * as Keychain from 'react-native-keychain';
import {
  getBearerToken,
  restoreAuthSession,
  signInWithEmail,
  signOut,
} from '../src/lib/auth';

const mockSignInEmail = (
  BetterAuthReact as unknown as {
    mockSignInEmail: jest.Mock<Promise<SignInResponse>, [SignInRequest]>;
  }
).mockSignInEmail;

const mockSignOut = (
  BetterAuthReact as unknown as {
    mockSignOut: jest.Mock<Promise<unknown>, []>;
  }
).mockSignOut;

const mockAuthClientConfig = (
  BetterAuthReact as unknown as {
    mockAuthClientConfig: { current: unknown };
  }
).mockAuthClientConfig;

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue({ error: null });
  mockSignInEmail.mockImplementation(async request => {
    request.fetchOptions.onSuccess({
      response: {
        headers: {
          get: name => (name === 'set-auth-token' ? 'session-token' : null),
        },
      },
    });
    return { data: null, error: null };
  });
  jest.mocked(Keychain.setGenericPassword).mockResolvedValue({
    service: 'app.lofipix.mobile.auth',
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  });
  jest.mocked(Keychain.getGenericPassword).mockResolvedValue(false);
  jest.mocked(Keychain.resetGenericPassword).mockResolvedValue(true);
});

test('sets the trusted native Origin header for Better Auth requests', () => {
  expect(mockAuthClientConfig.current).toEqual(
    expect.objectContaining({
      fetchOptions: expect.objectContaining({
        headers: { Origin: 'lofipix://' },
      }),
    }),
  );
});

test('stores the Better Auth bearer token in Keychain', async () => {
  await expect(
    signInWithEmail(' user@example.com ', 'password'),
  ).resolves.toEqual({ email: 'user@example.com' });

  expect(mockSignInEmail).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'user@example.com', password: 'password' }),
  );
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
    'user@example.com',
    'session-token',
    {
      service: 'app.lofipix.mobile.auth',
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  expect(getBearerToken()).toBe('session-token');
});

test('restores a persisted user and bearer token', async () => {
  jest.mocked(Keychain.getGenericPassword).mockResolvedValue({
    username: 'user@example.com',
    password: 'persisted-token',
    service: 'app.lofipix.mobile.auth',
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  });

  await expect(restoreAuthSession()).resolves.toEqual({ email: 'user@example.com' });
  expect(getBearerToken()).toBe('persisted-token');
});

test('surfaces Better Auth failures without saving a token', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSignInEmail.mockResolvedValue({
    data: null,
    error: { message: 'Invalid email or password.' },
  });

  try {
    await expect(
      signInWithEmail('user@example.com', 'wrong'),
    ).rejects.toThrow('Invalid email or password.');
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
    if (__DEV__) {
      expect(warning).toHaveBeenCalledWith(
        '[LoFi Pix Auth] POST https://api.example.test/api/auth/sign-in/email failed: Invalid email or password.',
      );
    }
  } finally {
    warning.mockRestore();
  }
});

test('logs the sign-in URL for network failures in development', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSignInEmail.mockRejectedValue(new TypeError('Network request failed'));

  try {
    await expect(
      signInWithEmail('user@example.com', 'password'),
    ).rejects.toThrow('Network request failed');
    if (__DEV__) {
      expect(warning).toHaveBeenCalledWith(
        '[LoFi Pix Auth] POST https://api.example.test/api/auth/sign-in/email failed: Network request failed',
      );
    } else {
      expect(warning).not.toHaveBeenCalled();
    }
  } finally {
    warning.mockRestore();
  }
});

test('clears the local session when the server sign-out request fails', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await signInWithEmail('user@example.com', 'password');
  mockSignOut.mockRejectedValue(new Error('Network request failed'));

  try {
    await signOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'app.lofipix.mobile.auth',
    });
    expect(getBearerToken()).toBeNull();
    if (__DEV__) {
      expect(warning).toHaveBeenCalledWith(
        '[LoFi Pix Auth] POST https://api.example.test/api/auth/sign-out failed: Network request failed',
      );
    }
  } finally {
    warning.mockRestore();
  }
});
