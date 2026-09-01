import { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '@/db';
import { DbErrorScreen } from '@/components/DbErrorScreen';
import { DbLoadingScreen } from '@/components/DbLoadingScreen';

/**
 * Root layout — plan 002 init gate. Await initDb() (migrations + category seed)
 * before rendering tabs; any failure shows the full-screen retry (Retry is safe:
 * migrations are recorded, seed is idempotent — re-run only continues).
 */
type DbState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready' };

export default function RootLayout() {
  const [dbState, setDbState] = useState<DbState>({ status: 'loading' });

  const runInit = useCallback(() => {
    initDb().then(
      () => setDbState({ status: 'ready' }),
      (error: unknown) => setDbState({ status: 'error', error }),
    );
  }, []);

  useEffect(() => {
    runInit();
  }, [runInit]);

  const handleRetry = useCallback(() => {
    setDbState({ status: 'loading' });
    runInit();
  }, [runInit]);

  if (dbState.status === 'loading') {
    return <DbLoadingScreen />;
  }

  if (dbState.status === 'error') {
    return <DbErrorScreen error={dbState.error} onRetry={handleRetry} />;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}