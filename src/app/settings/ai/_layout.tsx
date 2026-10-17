/**
 * AI config stack (plan 013) — per-provider BYOK screens pushed over the
 * tabs with their own headers + back buttons. Route: /settings/ai/[provider]
 * (gemini | deepseek), reachable only while signed in (the (tabs) gate covers
 * the Settings tab that links here).
 */
import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function AiSettingsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="[provider]" options={{ title: 'AI Provider' }} />
    </Stack>
  );
}