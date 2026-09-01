import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

/**
 * Full-screen migration/DB failure screen with Retry (ARCHITECTURE §11, plan 002
 * startup gate). Retry is safe: applied migrations are recorded in
 * `__drizzle_migrations` and the category seed is idempotent.
 */
export function DbErrorScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Database error</Text>
      <Text style={styles.note}>
        The app could not initialize its local database. Your data is safe — try again.
      </Text>
      <Text style={styles.detail} numberOfLines={4}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonLabel}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  note: {
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
  detail: {
    fontSize: typography.caption,
    color: colors.muted,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignSelf: 'flex-start',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: typography.emphasis,
    fontWeight: '600',
  },
});