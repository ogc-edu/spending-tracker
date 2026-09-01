/**
 * SessionStore abstraction (plan 003 A8) — auto-login across launches.
 * The current user id lives in expo-secure-store on-device; tests inject an
 * in-memory store so they don't need the native module.
 */

export interface SessionStore {
  getCurrentUserId(): Promise<number | null>;
  setCurrentUserId(id: number): Promise<void>;
  clearCurrentUserId(): Promise<void>;
}

const SESSION_KEY = 'current_user_id';

/**
 * Device implementation via expo-secure-store. Lazy-requires the module so
 * Node/Jest (which lacks the native module) can import this file.
 */
export class SecureStoreSessionStore implements SessionStore {
  private getSecureStore(): {
    getItemAsync(key: string): Promise<string | null>;
    setItemAsync(key: string, value: string): Promise<void>;
    deleteItemAsync(key: string): Promise<void>;
  } {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-secure-store') as {
      getItemAsync: (key: string) => Promise<string | null>;
      setItemAsync: (key: string, value: string) => Promise<void>;
      deleteItemAsync: (key: string) => Promise<void>;
    };
    return mod;
  }

  async getCurrentUserId(): Promise<number | null> {
    const raw = await this.getSecureStore().getItemAsync(SESSION_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  async setCurrentUserId(id: number): Promise<void> {
    await this.getSecureStore().setItemAsync(SESSION_KEY, String(id));
  }

  async clearCurrentUserId(): Promise<void> {
    await this.getSecureStore().deleteItemAsync(SESSION_KEY);
  }
}

/** In-memory store for Jest (deterministic, no native module). */
export class InMemorySessionStore implements SessionStore {
  private value: number | null = null;
  async getCurrentUserId(): Promise<number | null> {
    return this.value;
  }
  async setCurrentUserId(id: number): Promise<void> {
    this.value = id;
  }
  async clearCurrentUserId(): Promise<void> {
    this.value = null;
  }
}
