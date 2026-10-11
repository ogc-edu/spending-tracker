import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function ExpensesLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="new" options={{ title: 'Add expense', headerShown: false }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Expense', headerShown: false }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit expense', headerShown: false }} />
    </Stack>
  );
}