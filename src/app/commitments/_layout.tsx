/**
 * Commitments stack (plan 008 screens) — push screens over the tabs with
 * their own headers + back buttons. Routes: /commitments/new (create),
 * /commitments/[id] (plan 008 detail: schedule, mark-paid, un-pay, cancel,
 * C1 delete/archive) and /commitments/[id]/edit, reachable only while signed
 * in (the (tabs) gate covers the tab that links to them).
 *
 * Every route is registered with an explicit title — an unregistered one falls
 * back to its file path, which is how the edit screen came to show "[id]/edit".
 */
import { Stack } from 'expo-router';
import { geistWeights, useTheme } from '@/theme';

export default function CommitmentsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.text,
        headerTitleStyle: {
          color: colors.text,
          fontFamily: geistWeights.semiBold,
          fontSize: 17,
        },
        headerStyle: {
          backgroundColor: colors.bg,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.bg,
        },
      }}
    >
      <Stack.Screen name="new" options={{ title: 'Add commitment' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Commitment' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit commitment' }} />
    </Stack>
  );
}