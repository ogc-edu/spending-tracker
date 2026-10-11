import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { geistWeights, useTheme } from '@/theme';

/**
 * Full-screen migration/DB failure screen with Retry (ARCHITECTURE §11, plan 002
 * startup gate). Retry is safe: applied migrations are recorded in
 * `__drizzle_migrations` and the category seed is idempotent.
 */
export function DbErrorScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { colors } = useTheme();
  const message = error instanceof Error ? error.message : String(error);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.danger }]}>Database error</Text>
      <Text style={[styles.note, { color: colors.text }]}>
        The app could not initialize its local database. Your data is safe — try again.
      </Text>
      <Text style={[styles.detail, { color: colors.textTertiary }]} numberOfLines={4}>
        {message}
      </Text>
      <View style={styles.buttonWrap}>
        <PrimaryButton label="Retry" onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
  },
  note: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: geistWeights.medium,
  },
  detail: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.regular,
    marginBottom: 8,
  },
  buttonWrap: {
    alignSelf: 'stretch',
    maxWidth: 200,
  },
});