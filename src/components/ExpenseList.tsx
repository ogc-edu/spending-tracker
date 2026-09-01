/**
 * ExpenseList (plan 006) — the FlatList of expense rows with 50-row batch
 * pagination ("load more" on onEndReached, plan §Requirements). The pinned
 * totals bar and both empty states live OUTSIDE this component (the screen
 * decides which empty case applies); this renders rows + the loading footer.
 */
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import type { Account, Category, Expense } from '@/db/schema';
import { ExpenseRow } from '@/components/ExpenseRow';
import { spacing } from '@/theme';

export interface ExpenseListProps {
  expenses: Expense[];
  categories: Category[];
  accounts: Account[];
  /** True while more batches exist (offset + loaded < filtered count). */
  hasMore: boolean;
  onEndReached(): void;
  onPressRow(expense: Expense): void;
}

export function ExpenseList({ expenses, categories, accounts, hasMore, onEndReached, onPressRow }: ExpenseListProps) {
  const accountName = (id: number | null): string | null =>
    id == null ? null : (accounts.find((a) => a.id === id)?.name ?? null);

  return (
    <FlatList
      data={expenses}
      keyExtractor={(expense) => String(expense.id)}
      renderItem={({ item }) => (
        <ExpenseRow
          expense={item}
          category={categories.find((c) => c.id === item.categoryId)}
          accountName={accountName(item.accountId)}
          onPress={() => onPressRow(item)}
        />
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        hasMore ? <ActivityIndicator style={styles.footer} testID="expense-list-footer" /> : null
      }
      contentContainerStyle={styles.content}
      testID="expense-list"
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingBottom: 120 },
  footer: { marginVertical: spacing.lg },
});