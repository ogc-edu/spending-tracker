import { useCallback, useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDb } from '@/db';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { DbErrorScreen } from '@/components/DbErrorScreen';
import { DbLoadingScreen } from '@/components/DbLoadingScreen';
import { ToastProvider } from '@/components/ToastProvider';

// Prevent splash screen from auto-hiding until initial fonts, db, and auth are verified
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({
  duration: 350,
  fade: true,
});

// TEMP (QA sweep only): dev-build LogBox strips block bottom taps while
// offline (dev-tools websocket failures). REVERT BEFORE COMMIT.
LogBox.ignoreAllLogs();

/**
 * Root layout — plan 002 init gate + plan 003 AuthProvider gate,
 * plan 016: ToastProvider (write-failure toasts) + SafeAreaProvider
 * (safe-area insets for the toast and keyboard-avoiding screens;
 * react-native-safe-area-context's hooks throw outside a provider).
 * Flow: initDb() (migrations + category seed + user seed) → AuthProvider
 * (validates SecureStore session) → Stack. Tabs are gated by AuthProvider
 * status; login/register redirect to (tabs) when signed in and vice-versa
 * (each screen handles its own Redirect).
 */
type DbState = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready' };

function RootStack() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [status]);

  if (status === 'loading') {
    return <DbLoadingScreen />;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [dbState, setDbState] = useState<DbState>({ status: 'loading' });
  // Preload Ionicons so the tab bar glyphs render on first mount (New
  // Architecture + bottom-tabs race: without this, icon codepoints show as
  // blank boxes on cold start). Gate the tree until ready.
  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  const runInit = useCallback(() => {
    initDb().then(
      () => setDbState({ status: 'ready' }),
      (error: unknown) => {
        console.error('[initDb] failed:', error);
        setDbState({ status: 'error', error });
      },
    );
  }, []);

  useEffect(() => {
    runInit();
  }, [runInit]);

  const handleRetry = useCallback(() => {
    setDbState({ status: 'loading' });
    runInit();
  }, [runInit]);

  useEffect(() => {
    if (dbState.status === 'error') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [dbState.status]);

  if (!fontsLoaded || dbState.status === 'loading') {
    return <DbLoadingScreen />;
  }

  if (dbState.status === 'error') {
    return <DbErrorScreen error={dbState.error} onRetry={handleRetry} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <RootStack />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
