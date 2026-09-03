/**
 * PasswordHasher contract + FakeHasher (plan 003 / ARCHITECTURE §2, A7).
 *
 * The real hasher on-device is Pbkdf2Hasher (src/auth/pbkdf2Hasher.ts):
 * PBKDF2-HMAC-SHA256 via @noble/hashes — pure JS (no WASM, no native module),
 * Hermes/Expo Go-safe on both platforms (decision A7 rev 2026-09-03:
 * Argon2id → PBKDF2-SHA256 because Hermes cannot run WASM; 10,000
 * iterations, 16-byte salt, 32-byte key). Jest uses FakeHasher so tests
 * never pay the hashing cost.
 */

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encoded: string): Promise<boolean>;
}

/**
 * Deterministic hasher for Jest. Round-trips correctly and rejects mismatches
 * but is NOT secure — test-only.
 *
 * Encoded shape is a stable prefix so tests can assert is-not-plaintext
 * without coupling to the real Argon2 modular-crypt format.
 */
export class FakeHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `fake$${password}`;
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    return encoded === `fake$${password}`;
  }
}
