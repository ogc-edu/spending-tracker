/**
 * Pbkdf2Hasher — device hasher (plan 003 A7, REV 2026-09-03).
 *
 * Decision A7 rev (user, 2026-09-03): Argon2id → PBKDF2-HMAC-SHA256.
 * Rationale: Hermes (React Native's JS engine on Android/iOS) has NO
 * WebAssembly support, and every Argon2 JS implementation (hash-wasm,
 * argon2-browser, …) is WASM- or native-based — hash-wasm failed on-device
 * with "WebAssembly is not supported in this environment!" during the
 * first-run user seed (observed on a physical phone, 2026-09-03).
 * @noble/hashes is pure JS (no WASM, no native module) → runs on
 * Hermes / Expo Go on both platforms.
 *
 * Trade-off recorded in PRD/ARCH: PBKDF2-SHA256 is a weaker KDF than
 * Argon2id and diverges from the user's AWS auth-system choice; it was
 * accepted to keep the app dependency-free of WASM/native crypto.
 *
 * Parameters (OWASP PBKDF2 guidance, SHA-256 variant): 600,000 iterations,
 * 16-byte random salt, 32-byte derived key. Iterations are embedded in the
 * stored hash so future tuning never breaks existing records.
 *
 * Stored format:
 *
 *   pbkdf2-sha256$i=600000$<salt-b64>$<hash-b64>
 *
 * verify() re-derives with the STORED string's own iteration count and
 * compares in constant time (XOR-accumulate). Any malformed stored hash
 * returns `false` — never throws.
 *
 * Legacy `$argon2id$…` hashes (pre-2026-09-03 dev DBs) are NOT portable:
 * verify() returns false for them. No such DBs exist in the field; any dev
 * DB with them must clear the `users` table before upgrade (documented).
 */

import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

import type { PasswordHasher } from './passwordHasher';

export const PBKDF2_ITERATIONS = 600_000;
export const PBKDF2_SALT_BYTES = 16;
export const PBKDF2_HASH_BYTES = 32;
const PREFIX = 'pbkdf2-sha256';

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Generate `bytes` random salt bytes via Web Crypto (available in modern JS
 * runtimes including React Native / Expo and Node). Falls back to Math.random
 * only if crypto is unavailable — still unique but not cryptographically
 * strong — acceptable for a local-only gate, and logged on use.
 */
function randomSaltBytes(bytes = PBKDF2_SALT_BYTES): Uint8Array {
  const cryptoObj: Crypto | undefined = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    cryptoObj.getRandomValues(arr);
    return arr;
  }
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i += 1) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

/** Base64 encode (unpadded) — runs the same in Node/Jest, Hermes, browsers. */
function encodeBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    if (b1 === undefined) break;
    out += BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    if (b2 === undefined) break;
    out += BASE64_ALPHABET[b2 & 0x3f];
  }
  return out;
}

/** Tolerant base64 → bytes decoder (no Buffer/atob dependency). */
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

/** Constant-time compare — timing does not leak byte positions. */
function bytesEqualConstTime(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

export class Pbkdf2Hasher implements PasswordHasher {
  /**
   * TEST ONLY — fixed salt for deterministic known-vector tests, and a
   * downgraded iteration count to keep suites fast. Never pass these in
   * production (defaults: fresh 16-byte salt, 600,000 iterations).
   */
  private readonly saltOverride?: Uint8Array;
  private readonly iterationsOverride?: number;

  constructor(options: { saltOverride?: Uint8Array; iterations?: number } = {}) {
    this.saltOverride = options.saltOverride;
    this.iterationsOverride = options.iterations;
  }

  async hash(password: string): Promise<string> {
    const salt = this.saltOverride ?? randomSaltBytes(PBKDF2_SALT_BYTES);
    const iterations = this.iterationsOverride ?? PBKDF2_ITERATIONS;
    const hash = await pbkdf2Async(sha256, password, salt, {
      c: iterations,
      dkLen: PBKDF2_HASH_BYTES,
      asyncTick: 5, // yield to the UI thread periodically on Hermes
    });
    return `$${PREFIX}$i=${iterations}$${encodeBase64(salt)}$${encodeBase64(hash)}`;
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    try {
      const parts = encoded.split('$');
      if (parts.length !== 5 || parts[1] !== PREFIX) {
        return false; // includes legacy $argon2id$ strings — not portable
      }
      const itersMatch = /^i=(\d+)$/.exec(parts[2] ?? '');
      if (!itersMatch) return false;
      const salt = decodeBase64(parts[3] ?? '');
      const hash = decodeBase64(parts[4] ?? '');
      if (salt.length === 0 || hash.length === 0) return false;
      const computed = await pbkdf2Async(sha256, password, salt, {
        c: Number(itersMatch[1]),
        dkLen: hash.length,
        asyncTick: 5,
      });
      return bytesEqualConstTime(computed, hash);
    } catch {
      return false;
    }
  }
}