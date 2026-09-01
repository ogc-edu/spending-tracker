/**
 * Ambient types for the standalone hash-wasm Argon2 build
 * (`hash-wasm/dist/argon2.umd.min.js` — the ~29 kB single-algorithm UMD,
 * rather than the full ~270 kB index bundle). Mirrors the real
 * `hash-wasm/dist/lib/argon2.d.ts` surface for the bits this app uses.
 */
declare module 'hash-wasm/dist/argon2.umd.min.js' {
  export type Argon2DataType = string | Uint8Array;
  export type Argon2OutputType = 'hex' | 'binary' | 'encoded';

  export interface Argon2Options {
    /** Password (or message) to be hashed */
    password: Argon2DataType;
    /** Salt (usually containing random bytes) */
    salt: Argon2DataType;
    /** Secret for keyed hashing */
    secret?: Argon2DataType;
    /** Number of iterations to perform */
    iterations: number;
    /** Degree of parallelism */
    parallelism: number;
    /** Amount of memory to be used in kibibytes (1024 bytes) */
    memorySize: number;
    /** Output size in bytes */
    hashLength: number;
    /** Desired output type. Defaults to 'hex' */
    outputType?: Argon2OutputType;
  }

  type Argon2ReturnType<T> = T extends { outputType: 'binary' } ? Uint8Array : string;

  /** Calculates hash using the argon2id password-hashing function (v1.3 / v=19) */
  export function argon2id<T extends Argon2Options>(options: T): Promise<Argon2ReturnType<T>>;
}