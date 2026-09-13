/**
 * InlineError (plan 017) — the ONE load-failure surface for list screens.
 * Replaces the bare red `errorText` lines (dashboard, expenses, budgets,
 * commitments, analytics) with a soft danger panel: warning icon + message.
 * Pure presentation; screens keep their own error state and testIDs.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';

export function InlineError({ message, testID }: { message: string; testID?: string }) {
  return (
    <View style={styles.box} testID={testID}>
      <Ionicons name="warning-outline" size={16} color={colors.danger} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  text: { flex: 1, fontSize: typography.body, color: colors.danger, fontWeight: '600' },
});
