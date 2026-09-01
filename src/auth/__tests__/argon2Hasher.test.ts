/**
 * Argon2IdHasher (hash-wasm) tests — A16 swap verification (1).
 *
 * KNOWN-VECTOR NOTE (why this vector, and the RFC 9106 relationship):
 * RFC 9106 §5.3's Argon2id vector — 32×0x01 password, 16×0x02 salt,
 * t=3, m=32 KiB, p=4, secret 8×0x03, associated data 12×0x04 → tag
 * `0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659` —
 * includes an associated-data input, which hash-wasm 4.12's argon2id()
 * does not expose (password/salt/secret only). That vector therefore
 * cannot be reproduced through the public API.
 *
 * The vector pinned here is from the SAME reference implementation the
 * RFC's vector section is generated with (phc-winner-argon2), at the
 * app's exact production parameter set (t=2, m=65536 KiB, p=1, 32-byte
 * tag, password "password" / salt "somesalt"). It was byte-verified
 * against the reference binary at swap time (brew argon2 20190702_1:
 * `printf password | argon2 somesalt -id -t 2 -m 16 -p 1 -l 32` →
 * Hash 09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7,
 * Encoded `$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO
 * 6Mm5c8y7cJHAph8ArZWb2GRPPc`), and hash-wasm produces the identical
 * string — pinning both the Argon2id computation AND the MCF encoding
 * (unpadded base64, segment order) against the native lib's format.
 *
 * Verification (2) — the emulator-captured native-lib hash (seeded user,
 * "1234") — is performed separately against the real dev DB.
 */

import { describe, expect, test } from '@jest/globals';

import { Argon2IdHasher } from '@/auth/argon2Hasher';

// Reference-implementation output at production params (see header note).
const VECTOR_ENCODED =
  '$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO6Mm5c8y7cJHAph8ArZWb2GRPPc';

function hasherWithSalt(saltText: string): Argon2IdHasher {
  return new Argon2IdHasher({ saltOverride: new TextEncoder().encode(saltText) });
}

describe('Argon2IdHasher (hash-wasm)', () => {
  test('known vector — matches the reference implementation at production params', async () => {
    const encoded = await hasherWithSalt('somesalt').hash('password');
    expect(encoded).toBe(VECTOR_ENCODED);
  });

  test('hash() emits the modular-crypt MCF format of the native lib', async () => {
    const encoded = await hasherWithSalt('somesalt').hash('password');
    // $argon2id$v=19$m=65536,t=2,p=1$<salt-b64>$<hash-b64> — unpadded base64
    expect(encoded).toMatch(
      /^\$argon2id\$v=19\$m=65536,t=2,p=1\$[A-Za-z0-9+/]{1,}\$[A-Za-z0-9+/]{1,}$/,
    );
  });

  test('verify() accepts the known-vector hash and rejects a wrong password', async () => {
    const hasher = new Argon2IdHasher();
    await expect(hasher.verify('password', VECTOR_ENCODED)).resolves.toBe(true);
    await expect(hasher.verify('Password', VECTOR_ENCODED)).resolves.toBe(false);
    await expect(hasher.verify('', VECTOR_ENCODED)).resolves.toBe(false);
  });

  test('verify() is tolerant of padded base64 segments (native-lib format compat)', async () => {
    const [, , , , salt, hash] = VECTOR_ENCODED.split('$');
    // Same bytes, padded to 4-aligned lengths with '='.
    const padded = `$argon2id$v=19$m=65536,t=2,p=1$${salt! + '='}$${hash! + '='}`;
    const hasher = new Argon2IdHasher();
    await expect(hasher.verify('password', padded)).resolves.toBe(true);
    await expect(hasher.verify('nope', padded)).resolves.toBe(false);
  });

  test('verify() returns false (never throws) for malformed stored hashes', async () => {
    const hasher = new Argon2IdHasher();
    for (const bad of [
      '',
      'not-an-argon2-string',
      '$argon2i$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$AAAA',
      '$argon2id$v=19$m=banana,t=2,p=1$c29tZXNhbHQ$AAAA',
      '$argon2id$v=19$m=65536,t=2,p=1$$',
    ]) {
      await expect(hasher.verify('password', bad)).resolves.toBe(false);
    }
  });

  test('verify() round-trips a freshly hashed password', async () => {
    const hasher = new Argon2IdHasher();
    const encoded = await hasher.hash('1234');
    await expect(hasher.verify('1234', encoded)).resolves.toBe(true);
    await expect(hasher.verify('12345', encoded)).resolves.toBe(false);
  });

  test('hash() salts randomly — same password hashes differently each call', async () => {
    const hasher = new Argon2IdHasher();
    const a = await hasher.hash('1234');
    const b = await hasher.hash('1234');
    expect(a).not.toBe(b);
  });
});