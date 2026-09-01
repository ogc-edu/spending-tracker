/**
 * AuthProvider — React context gate (plan 003 routing gate / ARCHITECTURE §5).
 *
 * Exposes {status: loading | signedOut | signedIn, user, login, register, logout}
 * and validates the persisted current_user_id on boot (stale id → signedOut).
 * The device hasher is Argon2IdHasher (native); callers can inject FakeHasher in tests
 * but the provider itself always uses the real hasher on-device.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Argon2IdHasher } from '@/auth/argon2Hasher';
import { SecureStoreSessionStore } from '@/auth/sessionStore';
import type { User } from '@/db/schema';
import { getDb } from '@/db';
import { DrizzleUserRepository } from '@/repositories/drizzle/userRepository';
import { AuthService } from '@/services/AuthService';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // Memoize service deps per render (they are stateless wrappers around db/storage).
  const { authService } = useMemo(() => {
    const db = getDb();
    const repo = new DrizzleUserRepository(db as unknown as never);
    const hasher = new Argon2IdHasher();
    const session = new SecureStoreSessionStore();
    return { authService: new AuthService(repo, hasher, session) };
  }, []);

  const refresh = useCallback(async () => {
    const current = await authService.currentUser();
    if (current) {
      setUser(current);
      setStatus('signedIn');
    } else {
      setUser(null);
      setStatus('signedOut');
    }
  }, [authService]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await authService.currentUser();
        if (cancelled) return;
        if (current) {
          setUser(current);
          setStatus('signedIn');
        } else {
          setUser(null);
          setStatus('signedOut');
        }
      } catch {
        if (cancelled) return;
        setUser(null);
        setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authService]);

  const login = useCallback(
    async (email: string, password: string) => {
      const u = await authService.login(email, password);
      setUser(u);
      setStatus('signedIn');
    },
    [authService],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const u = await authService.register(email, password);
      setUser(u);
      setStatus('signedIn');
    },
    [authService],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setStatus('signedOut');
  }, [authService]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, refresh }),
    [status, user, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
