/**
 * EmptyState (plans 006 + 016) — the one empty-state component every tab
 * reuses: icon + title + body, optionally with a single action link
 * (plan 016: "one EmptyState component with action links"). Two history
 * cases in Expenses (no expenses vs no filter results) pick their own
 * title/body, same as plan 006; other tabs pass actions that navigate
 * (Dashboard → Settings/Add expense, Budgets → set overall budget…).
 *
 * The action is a ≥44pt button (touchTarget) with a screen-reader role —
 * asserted in the component test.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, touchTarget, typography } from '@/theme';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  /** Optional single primary action (a link-style button). */
  action?: { label: string; onPress(): void };
  testID?: string;
}

export function EmptyState({ icon, title, body, action, testID }: EmptyStateProps) {
  return (
    <View style={styles.box} testID={testID}>
      <Ionicons name={icon} size={44} color={colors.muted} style={styles.icon} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, touchTarget, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          testID={testID ? `${testID}-action` : 'empty-state-action'}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
  icon: { marginBottom: spacing.md },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  body: { fontSize: typography.body, color: colors.muted, textAlign: 'center', lineHeight: 21, marginBottom: spacing.lg },
  action: {
    backgroundColor: colors.accent,
    borderRadius: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});