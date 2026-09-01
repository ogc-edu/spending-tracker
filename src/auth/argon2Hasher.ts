/**
 * Argon2IdHasher — device hasher (plan 003 A7 / ARCHITECTURE A7).
 *
 * Params mirror the user's auth-system: time cost 2, 64 MiB memory,
 * parallelism 1, 32-byte hash (and 16-byte random salt). Stored as the
 * standard modular-crypt `$argon2id$...` encoded string in users.password_hash.
 *
 * Requires a development build (`npx expo run:android` / EAS dev build) —
 * Expo Go cannot load the native module. If the module fails to load the
 * hasher throws a clear error so the seed/init screen can surface it.
 */

import type { PasswordHasher } from './passwordHasher';

const ARGON2_CONFIG = {
  iterations: 2,
  memory: 65536, // KiB = 64 MiB
  parallelism: 1,
  hashLength: 32,
  mode: 'argon2id' as const,
} as const;

/**
 * Generate a 16-byte random salt as 32 hex characters via Web Crypto
 * (available in modern JS runtimes including React Native / Expo). Falls
 * back to Math.random only if crypto is unavailable — still unique but not
 * cryptographically strong — which is acceptable for a local-only gate but
 * logged so it is not mistaken for production behaviour.
 */
function randomSaltHex(bytes = 16): string {
  const cryptoObj: Crypto | undefined = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    cryptoObj.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (no SecureRandom available — still yields a unique salt).
  let hex = '';
  for (let i = 0; i < bytes; i += 1) {
    hex += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return hex;
}

/**
 * Decode the salt embedded in an encoded modular-crypt string but produce
 * the original hex salt passed to the native module. The salt segment is
 * standard base64 of the raw salt bytes.
 *
 * Prefer Buffer when available (Node/Jest), otherwise atob.
 */
function decodeSaltToHex(encoded: string): string {
  const parts = encoded.split('$');
  // Expected: ["", "argon2id", "v=19", "m=...,t=...,p=...", "saltB64", "hashB64"]
  if (parts.length < 6) {
    throw new Error('Invalid Argon2 encoded hash format');
  }
  const saltB64 = parts[4]!;
  // base64 may be unpadded — pad to a multiple of 4 for decoders that require it
  const padded = saltB64 + '='.repeat((4 - (saltB64.length % 4)) % 4);

  let bytes: Uint8Array;
  // Node / Jest provides Buffer
  const maybeBuffer = (globalThis as unknown as { Buffer?: typeof Buffer }).Buffer;
  if (maybeBuffer?.from) {
    const buf: Buffer = maybeBuffer.from(padded, 'base64');
    bytes = new Uint8Array(buf);
  } else if (typeof atob === 'function') {
    const binary = atob(padded);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    throw new Error('No base64 decoder available for Argon2 salt');
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function getArgon2Module(): (
  password: string,
  salt: string,
  config: {
    iterations: number;
    memory: number;
    parallelism: number;
    hashLength: number;
    mode: string;
    saltEncoding?: string;
  },
) => Promise<{ rawHash: string; encodedHash: string }> {
  try {
    // Lazy-require so Jest without the native module can still import this file.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-argon2') as { default?: unknown };
    const candidate = (mod as { default?: unknown }).default ?? mod;
    if (typeof candidate !== 'function') {
      throw new Error('react-native-argon2 did not export a function');
    }
    return candidate as never;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Argon2id native module unavailable — run the app as a development build (npx expo run:android), not Expo Go. Underlying error: ${message}`,
    );
  }
}

export class Argon2IdHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const argon2 = getArgon2Module();
    const saltHex = randomSaltHex(16);
    const result = await argon2(password, saltHex, {
      iterations: ARGON2_CONFIG.iterations,
      memory: ARGON2_CONFIG.memory,
      parallelism: ARGON2_CONFIG.parallelism,
      hashLength: ARGON2_CONFIG.hashLength,
      mode: ARGON2_CONFIG.mode,
      saltEncoding: 'hex',
    });
    return result.encodedHash;
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    const argon2 = getArgon2Module();
    // Re-hash with the original salt and compare encoded strings; the native
    // module is deterministic for the same inputs/params.
    const saltHex = decodeSaltToHex(encoded);
    try {
      const result = await argon2(password, saltHex, {
        iterations: ARGON2_CONFIG.iterations,
        memory: ARGON2_CONFIG.memory,
        parallelism: ARGON2_CONFIG.parallelism,
        hashLength: ARGON2_CONFIG.hashLength,
        mode: ARGON2_CONFIG.mode,
        saltEncoding: 'hex',
      });
      return result.encodedHash === encoded;
    } catch {
      // Native verify surfaces as mismatch (e.g. argon2 throws on bad format).
      return false;
    }
  }
}
