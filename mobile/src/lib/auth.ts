import { createAuthClient } from 'better-auth/react';
import * as Keychain from 'react-native-keychain';
import { mobileEnvironment } from '../config/environment';

const KEYCHAIN_SERVICE = 'app.lofipix.mobile.auth';
const SIGN_IN_URL = `${mobileEnvironment.API_URL.replace(/\/+$/, '')}/api/auth/sign-in/email`;
const SIGN_OUT_URL = `${mobileEnvironment.API_URL.replace(/\/+$/, '')}/api/auth/sign-out`;
let bearerToken: string | null = null;

function logAuthRequestFailure(url: string, error: unknown) {
  if (!__DEV__) return;
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(`[LoFi Pix Auth] POST ${url} failed: ${detail}`);
}

const authClient = createAuthClient({
  baseURL: mobileEnvironment.API_URL,
  disableDefaultFetchPlugins: true,
  fetchOptions: {
    headers: {
      Origin: 'lofipix://',
    },
    auth: {
      type: 'Bearer',
      token: () => bearerToken ?? undefined,
    },
  },
});

export type MobileUser = {
  email: string;
};

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<MobileUser> {
  let receivedToken: string | null = null;
  const normalizedEmail = email.trim();
  let result: Awaited<ReturnType<typeof authClient.signIn.email>>;
  try {
    result = await authClient.signIn.email({
      email: normalizedEmail,
      password,
      fetchOptions: {
        onSuccess: context => {
          receivedToken = context.response.headers.get('set-auth-token');
        },
      },
    });
  } catch (error) {
    logAuthRequestFailure(SIGN_IN_URL, error);
    throw error;
  }

  if (result.error) {
    logAuthRequestFailure(SIGN_IN_URL, result.error.message);
    throw new Error(result.error.message || 'Unable to sign in.');
  }
  if (!receivedToken) {
    throw new Error('The sign-in response did not include a bearer token.');
  }

  const stored = await Keychain.setGenericPassword(
    normalizedEmail,
    receivedToken,
    {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  if (!stored) {
    throw new Error('Unable to securely save the sign-in token.');
  }

  bearerToken = receivedToken;
  return { email: normalizedEmail };
}

export async function restoreAuthSession(): Promise<MobileUser | null> {
  bearerToken = null;
  const credentials = await Keychain.getGenericPassword({
    service: KEYCHAIN_SERVICE,
  });
  if (!credentials) return null;

  bearerToken = credentials.password;
  return { email: credentials.username };
}

export function getBearerToken() {
  return bearerToken;
}

export async function signOut() {
  try {
    const result = await authClient.signOut();
    if (result.error) {
      logAuthRequestFailure(SIGN_OUT_URL, result.error.message);
    }
  } catch (error) {
    logAuthRequestFailure(SIGN_OUT_URL, error);
  } finally {
    bearerToken = null;
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  }
}
