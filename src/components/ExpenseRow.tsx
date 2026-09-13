import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Category, Expense } from '@/db/schema';
import { categoryColor } from '@/components/categoryMeta';
import { formatDayLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { Badge } from '@/components/ui/Badge';

export interface ExpenseRowProps {
  expense: Expense;
  category: Category | undefined;
  /** Null hides the account segment (expense has no account). */
  accountName: string | null;
  onPress(): void;
}

export function ExpenseRow({ expense, category, accountName, onPress }: ExpenseRowProps) {
  const linked = expense.commitmentPaymentId !== null;
  const catColor = categoryColor(expense.categoryId);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => (pressed ? [styles.row, styles.pressed] : styles.row)}
      android_ripple={{ color: 'rgba(0,0,0,0.05)', borderless: false }}
      accessibilityRole="button"
      testID={`expense-row-${expense.id}`}
    >
      <View style={[styles.avatar, { backgroundColor: `${catColor}18` }]}>
        <Ionicons
          name={(category?.icon ?? 'receipt-outline') as never}
          size={18}
          color={catColor}
        />
      </View>
      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {expense.description ? expense.description : (category?.name ?? 'Category')}
          </Text>
          <Text style={styles.rowAmount}>{formatSen(expense.amountSen)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {formatDayLabel(expense.date)}
            {expense.description ? ` · ${category?.name ?? 'Expense'}` : ''}
            {accountName ? ` · ${accountName}` : ''}
          </Text>
          {linked ? (
            <Badge tone="warning" label="commitment" icon="link-outline" />
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowInfo: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: typography.body, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm },
  rowAmount: {
    fontSize: typography.emphasis,
    fontWeight: '700',
    color: colors.text,
    fontVariant: moneyFontVariant,
  },
  rowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  rowMeta: { fontSize: typography.caption, color: colors.muted, fontWeight: '500', flex: 1 },
  chevron: { marginLeft: spacing.xs },
});