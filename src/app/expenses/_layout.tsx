/**
 * Expenses stack (plan 005 + 006 screens) — push screens over the tabs with
 * their own headers + back buttons. Routes: /expenses/new (create),
 * /expenses/[id] (plan 006 detail + delete), /expenses/[id]/edit (edit /
 * E7 read-only linked view), reachable only while signed in (the (tabs)
 * gate covers the tab that links to them).
 */
import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function ExpensesLayout() {
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
      <Stack.Screen name="new" options={{ title: 'Add expense' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Expense' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit expense' }} />
    </Stack>
  );
}