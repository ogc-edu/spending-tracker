import '../../global.css';
import { useCallback, useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortalHost } from '@rn-primitives/portal';
import { initDb } from '@/db';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { DbErrorScreen } from '@/components/DbErrorScreen';
import { DbLoadingScreen } from '@/components/DbLoadingScreen';
import { ToastProvider } from '@/components/ToastProvider';
import { ThemeProvider, useTheme } from '@/theme';

// Prevent splash screen from auto-hiding until initial fonts, db, and auth are verified
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({
  duration: 350,
  fade: true,
});

// TEMP (QA sweep only): dev-build LogBox strips block bottom taps while
// offline (dev-tools websocket failures). REVERT BEFORE COMMIT.
LogBox.ignoreAllLogs();

type DbState = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready' };

function RootStack() {
  const { status } = useAuth();
  const { scheme, colors } = useTheme();

  useEffect(() => {
    if (status !== 'loading') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [status]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  if (status === 'loading') {
    return <DbLoadingScreen />;
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </>
  );
}

function RootContent() {
  const [dbState, setDbState] = useState<DbState>({ status: 'loading' });
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });
  const [fontFallback, setFontFallback] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFontFallback(true), 1500);
    return () => clearTimeout(timer);
  }, []);

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

  const fontsReady = fontsLoaded || fontError != null || fontFallback;

  if (!fontsReady || dbState.status === 'loading') {
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
      <PortalHost />
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}
