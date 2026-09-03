/**
 * Pbkdf2Hasher tests — decision A7 rev (2026-09-03) verification.
 * Known vector: PBKDF2-HMAC-SHA256, password "password", salt "salt",
 * c=1, dkLen=32 → 120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b
 */

import { describe, expect, it } from '@jest/globals';
import { Pbkdf2Hasher, PBKDF2_ITERATIONS } from '@/auth/pbkdf2Hasher';

const VECTOR_HASH_HEX =
  '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b';

function hasherWithSalt(saltText: string, iterations = PBKDF2_ITERATIONS): Pbkdf2Hasher {
  return new Pbkdf2Hasher({
    saltOverride: new TextEncoder().encode(saltText),
    iterations,
  });
}

describe('Pbkdf2Hasher (A7 rev 2026-09-03)', () => {
  it('verifies a round-trip hash (deterministic salt)', async () => {
    const h = hasherWithSalt('fixed-salt-16b');
    const encoded = await h.hash('correct horse');
    expect(await h.verify('correct horse', encoded)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const h = hasherWithSalt('fixed-salt-16b');
    const encoded = await h.hash('correct horse');
    expect(await h.verify('wrong horse', encoded)).toBe(false);
  });

  it('matches the RFC/PBKDF2-SHA256 known vector (c=1)', async () => {
    const h = hasherWithSalt('salt', 1);
    const encoded = await h.hash('password');
    const hashB64 = encoded.split('$')[4]!;
    const hex = [...decodeHex(hashB64)].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe(VECTOR_HASH_HEX);
  });

  it('emits the documented format and parameter segments', async () => {
    const h = hasherWithSalt('0123456789abcdef');
    const encoded = await h.hash('pw');
    const parts = encoded.split('$');
    expect(parts[0]).toBe('');
    expect(parts[1]).toBe('pbkdf2-sha256');
    expect(parts[2]).toBe(`i=${PBKDF2_ITERATIONS}`);
    // 16-byte salt and 32-byte hash, unpadded base64: 22/24 and 43 chars.
    expect(parts[3]).toHaveLength(22);
    expect(parts[4]).toHaveLength(43);
  });

  it('uses a fresh random salt per hash by default', async () => {
    const h = new Pbkdf2Hasher({ iterations: 1000 });
    const a = await h.hash('same');
    const b = await h.hash('same');
    expect(a).not.toBe(b);
    expect(await h.verify('same', a)).toBe(true);
    expect(await h.verify('same', b)).toBe(true);
  });

  it('verifies using the iteration count embedded in the stored string', async () => {
    const h = hasherWithSalt('another-salt-1', 1000);
    const encoded = await h.hash('pw');
    expect(encoded).toContain('$i=1000$');
    const fresh = new Pbkdf2Hasher(); // default params — must still verify
    expect(await fresh.verify('pw', encoded)).toBe(true);
  });

  it('returns false — never throws — for malformed or legacy hashes', async () => {
    const h = new Pbkdf2Hasher({ iterations: 1000 });
    const garbage = ['not-a-hash', '', '$argon2id$v=19$m=65536,t=2,p=1$AAAA$BBBB', 'pbkdf2-sha256$i=abc$AAAA$BBBB', 'pbkdf2-sha256$i=1000$!!garbage!!$BBBB'];
    for (const g of garbage) {
      expect(await h.verify('pw', g)).toBe(false);
    }
  });

  it('strings are not plaintext', async () => {
    const h = hasherWithSalt('fixed-salt-16b', 1000);
    const encoded = await h.hash('secret123');
    expect(encoded).not.toContain('secret123');
  });
});

/** Minimal unpadded-base64 → bytes (mirrors the hasher's tolerant decode). */
function decodeHex(b64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i += 1) {
    const code = alphabet.indexOf(b64[i]!);
    if (code === -1) continue;
    buffer = (buffer << 6) | code;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}