/**
 * ExpenseRow (plan 006) — one expense in the history list: category dot,
 * category name + amount, meta line (date · description · account), and the
 * E7 linked badge for commitment auto-created expenses. Presentational —
 * the screen resolves category/account names and the press handler.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Category, Expense } from '@/db/schema';
import { categoryColor } from '@/components/categoryMeta';
import { formatDayLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

export interface ExpenseRowProps {
  expense: Expense;
  category: Category | undefined;
  /** Null hides the account segment (expense has no account). */
  accountName: string | null;
  onPress(): void;
}

export function ExpenseRow({ expense, category, accountName, onPress }: ExpenseRowProps) {
  const linked = expense.commitmentPaymentId !== null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => (pressed ? [styles.row, styles.pressed] : styles.row)}
      accessibilityRole="button"
      testID={`expense-row-${expense.id}`}
    >
      <View style={[styles.categoryDot, { backgroundColor: categoryColor(expense.categoryId) }]} />
      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {category?.name ?? 'Category'}
          </Text>
          <Text style={styles.rowAmount}>{formatSen(expense.amountSen)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {formatDayLabel(expense.date)}
            {expense.description ? ` · ${expense.description}` : ''}
            {accountName ? ` · ${accountName}` : ''}
          </Text>
          {linked ? (
            <View style={styles.linkedChip}>
              <Ionicons name="link-outline" size={11} color={colors.warning} />
              <Text style={styles.linkedChipLabel}>commitment</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.6 },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
  rowInfo: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: typography.body, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
  rowAmount: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  rowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  rowMeta: { fontSize: typography.caption, color: colors.muted, flex: 1 },
  linkedChip: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: spacing.sm },
  linkedChipLabel: { fontSize: 10, color: colors.warning, fontWeight: '700' },
});