/**
 * Commitments stack (plan 008 screens) — push screens over the tabs with
 * their own headers + back buttons. Routes: /commitments/new (create) and
 * /commitments/[id] (plan 008 detail: schedule, mark-paid, un-pay, cancel,
 * C1 delete/archive), reachable only while signed in (the (tabs) gate covers
 * the tab that links to them).
 */
import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function CommitmentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        headerStyle: { backgroundColor: colors.background },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="new" options={{ title: 'Add commitment' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Commitment' }} />
    </Stack>
  );
}