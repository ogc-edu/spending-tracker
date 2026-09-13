/**
 * ExpenseList (plan 006; plan 018) — the expense history as a GROUPED list:
 * one shared surface (List) with hairline separators, rows grouped under
 * date section labels (Today / Yesterday / DD Mon) via SectionList. Grouping
 * is presentational over the already-fetched, date-desc page — a day that
 * spans a 50-row page boundary simply repeats its header on the next page
 * (named in plan 018 §7). Pagination ("load more" on onEndReached) and the
 * loading footer are unchanged; the pinned totals bar and empty states stay
 * OUTSIDE (the screen decides which empty case applies).
 */
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet } from 'react-native';
import type { Account, Category, Expense } from '@/db/schema';
import { ExpenseRow } from '@/components/ExpenseRow';
import { SectionLabel } from '@/components/ui/List';
import { formatDayLabel, todayLocal } from '@/utils/dates';
import { colors, spacing } from '@/theme';

export interface ExpenseListProps {
  expenses: Expense[];
  categories: Category[];
  accounts: Account[];
  /** True while more batches exist (offset + loaded < filtered count). */
  hasMore: boolean;
  onEndReached(): void;
  onRefresh?(): void;
  refreshing?: boolean;
  onPressRow(expense: Expense): void;
}

/** One dated section over the date-desc page (order preserved). */
interface ExpenseSection {
  title: string;
  data: Expense[];
}

/** "Today" / "Yesterday" / "DD Mon" label for a `YYYY-MM-DD` date. */
function dateGroupLabel(dateStr: string, today: string): string {
  if (dateStr === today) return 'Today';
  // Yesterday: today − 1 day, local calendar (no Date objects cross the seam —
  // build the label from the same string arithmetic the engine uses).
  const [y, m, d] = today.split('-').map(Number);
  const yesterday = new Date(y, m - 1, d - 1);
  const pad = (n: number): string => String(n).padStart(2, '0');
  const ymd = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
  if (dateStr === ymd) return 'Yesterday';
  return formatDayLabel(dateStr);
}

export function groupByDate(expenses: Expense[]): ExpenseSection[] {
  const today = todayLocal();
  const sections: ExpenseSection[] = [];
  for (const expense of expenses) {
    const title = dateGroupLabel(expense.date, today);
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.data.push(expense);
    } else {
      sections.push({ title, data: [expense] });
    }
  }
  return sections;
}

export function ExpenseList({
  expenses,
  categories,
  accounts,
  hasMore,
  onEndReached,
  onRefresh,
  refreshing = false,
  onPressRow,
}: ExpenseListProps) {
  const accountName = (id: number | null): string | null =>
    id == null ? null : (accounts.find((a) => a.id === id)?.name ?? null);

  const sections = groupByDate(expenses);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(expense) => String(expense.id)}
      renderSectionHeader={({ section }) => <SectionLabel>{section.title}</SectionLabel>}
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
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} /> : undefined
      }
      ListFooterComponent={
        hasMore ? <ActivityIndicator style={styles.footer} testID="expense-list-footer" /> : null
      }
      contentContainerStyle={styles.content}
      testID="expense-list"
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120 },
  footer: { marginVertical: spacing.lg },
});
