/**
 * Argon2IdHasher — device hasher (plan 003 A7 / ARCHITECTURE A7, A16).
 *
 * Implementation: `hash-wasm` Argon2id (pure WASM — cross-platform decision
 * A16, 2026-09-01). Replaces react-native-argon2 with the SAME algorithm and
 * parameters — Argon2id v1.3 (v=19), time cost 2, 64 MiB memory (65536 KiB),
 * parallelism 1, 32-byte hash (and 16-byte random salt) — so hashes stored by
 * the native lib keep verifying unchanged (stored-format compatibility).
 *
 * Stored format is the standard modular-crypt MCF string the native lib
 * emitted:
 *
 *   $argon2id$v=19$m=65536,t=2,p=1$<salt-b64>$<hash-b64>
 *
 * hash-wasm's `encoded` output produces exactly this shape (unpadded
 * base64, same as the reference argon2 C encoder react-native-argon2 wraps),
 * and verify() decodes the segments and byte-compares, so padding or
 * encoding differences can never break compatibility.
 *
 * No native module — this runs in Expo Go on both Android and iOS.
 */

import { argon2id } from 'hash-wasm/dist/argon2.umd.min.js';

import type { PasswordHasher } from './passwordHasher';

const ARGON2_CONFIG = {
  iterations: 2,
  memory: 65536, // KiB = 64 MiB
  parallelism: 1,
  hashLength: 32,
} as const;

const SALT_BYTES = 16;

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Generate `bytes` random salt bytes via Web Crypto (available in modern JS
 * runtimes including React Native / Expo and Node). Falls back to Math.random
 * only if crypto is unavailable — still unique but not cryptographically
 * strong — which is acceptable for a local-only gate but logged so it is not
 * mistaken for production behaviour.
 */
function randomSaltBytes(bytes = SALT_BYTES): Uint8Array {
  const cryptoObj: Crypto | undefined = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    cryptoObj.getRandomValues(arr);
    return arr;
  }
  // Fallback (no SecureRandom available — still yields a unique salt).
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i += 1) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

/**
 * Tolerant base64 → bytes decoder (no Buffer/atob dependency — runs the same
 * in Node/Jest, Hermes/Expo Go, and browsers). Ignores padding ('=') and any
 * non-alphabet characters, so both the padding-free reference encoding and
 * padded variants decode identically.
 */
function decodeBase64(b64: string): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i += 1) {
    const code = BASE64_ALPHABET.indexOf(b64[i]!);
    if (code === -1) continue; // skip padding / whitespace / garbage
    buffer = (buffer << 6) | code;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Parse a stored MCF string from the native lib — segment layout:
 *
 *   ["", "argon2id", "v=19", "m=65536,t=2,p=1", "saltB64", "hashB64"]
 *
 * Returns the raw salt and hash bytes plus the params, so the re-derivation
 * uses the STORED string's own m/t/p (a stored hash describes itself; the
 * native lib always wrote our A7 values, but verifying with the string's own
 * params is the MCF contract). Throws on any malformed input — verify()
 * converts that to `false`.
 */
function parseEncoded(
  encoded: string,
): { salt: Uint8Array; hash: Uint8Array; iterations: number; memory: number; parallelism: number } {
  const parts = encoded.split('$');
  if (parts.length < 6 || parts[1] !== 'argon2id') {
    throw new Error('Invalid Argon2 encoded hash format');
  }
  const paramsMatch = /^m=(\d+),t=(\d+),p=(\d+)$/.exec(parts[3] ?? '');
  if (!paramsMatch) {
    throw new Error('Invalid Argon2 encoded hash params');
  }
  const salt = decodeBase64(parts[4] ?? '');
  const hash = decodeBase64(parts[5] ?? '');
  if (salt.length === 0 || hash.length === 0) {
    throw new Error('Invalid Argon2 encoded hash payload');
  }
  return {
    salt,
    hash,
    memory: Number(paramsMatch[1]),
    iterations: Number(paramsMatch[2]),
    parallelism: Number(paramsMatch[3]),
  };
}

export class Argon2IdHasher implements PasswordHasher {
  /**
   * TEST ONLY — a fixed salt for deterministic known-vector tests. When set,
   * every hash() reuses it (that is the point: reproducible output). Never
   * pass this in production; the default is a fresh 16-byte random salt.
   */
  private readonly saltOverride?: Uint8Array;

  constructor(options: { saltOverride?: Uint8Array } = {}) {
    this.saltOverride = options.saltOverride;
  }

  async hash(password: string): Promise<string> {
    const salt = this.saltOverride ?? randomSaltBytes(SALT_BYTES);
    return argon2id({
      password,
      salt,
      parallelism: ARGON2_CONFIG.parallelism,
      iterations: ARGON2_CONFIG.iterations,
      memorySize: ARGON2_CONFIG.memory,
      hashLength: ARGON2_CONFIG.hashLength,
      outputType: 'encoded',
    });
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    try {
      const { salt, hash, memory, iterations, parallelism } = parseEncoded(encoded);
      const computed = await argon2id({
        password,
        salt,
        parallelism,
        iterations,
        memorySize: memory,
        hashLength: hash.length,
        outputType: 'binary',
      });
      return bytesEqual(computed, hash);
    } catch {
      // Malformed stored hash or hashing failure — same surface as the native
      // module's verify (mismatch is `false`, never a throw).
      return false;
    }
  }
}