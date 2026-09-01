/**
 * PasswordHasher contract + FakeHasher (plan 003 / ARCHITECTURE §2, A7).
 *
 * The real hasher on-device is Argon2IdHasher (src/auth/argon2Hasher.ts)
 * which wraps hash-wasm Argon2id (pure WASM — decision A16: time=2,
 * memory=65536 KiB, parallelism=1, hashLength=32, mode argon2id). No native
 * module — Expo Go works on both platforms. Jest uses FakeHasher so tests
 * never pay the 64 MiB Argon2 cost.
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
