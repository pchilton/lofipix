import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY_ENV = 'STORAGE_PROVIDER_CREDENTIALS_KEY';
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Resolves the per-field credential encryption key from
 * `STORAGE_PROVIDER_CREDENTIALS_KEY` in `.env.<REGION>`.
 *
 * The key is a hex-encoded 32-byte value and is never committed to the repo.
 */
function getKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex) {
    throw new Error(`Missing required environment variable ${KEY_ENV}.`);
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `${KEY_ENV} must be a hex-encoded ${KEY_BYTES}-byte key (got ${key.length} bytes).`,
    );
  }
  return key;
}

/**
 * Encrypts a single secret field value with AES-256-GCM.
 *
 * Returns `base64(iv):base64(tag):base64(ciphertext)` with a fresh random
 * 96-bit IV per field per encryption.
 */
export function encryptCredential(value: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypts a single secret field value produced by `encryptCredential`.
 *
 * A value that does not contain exactly three non-empty base64 parts is
 * invalid.
 */
export function decryptCredential(value: string): string {
  const key = getKey();
  const parts = value.split(':');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new Error(
      'Invalid encrypted credential: expected base64(iv):base64(tag):base64(ciphertext).',
    );
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8',
  );
}
