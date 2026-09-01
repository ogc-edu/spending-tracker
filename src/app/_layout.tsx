import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * Root layout. Plan 002 adds the database init gate here
 * (initDb() with a full-screen retry on migration failure).
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}