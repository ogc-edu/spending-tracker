/**
 * ExpenseList (Plan 004 — Audit Ledger)
 *
 * Daily grouped modular BentoCard containers with date headers and daily totals via MoneyDisplay.
 * List container tagged with testID="expenses-list" and testID="expense-list".
 * Pagination and pull-to-refresh preserved.
 */
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { Account, Category, Expense } from '@/db/schema';
import { ExpenseRow } from '@/components/ExpenseRow';
import { BentoCard } from '@/components/ui/BentoCard';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
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
  onEditRow?(expense: Expense): void;
  onDeleteRow?(expense: Expense): void;
}

/** One dated section over the date-desc page (order preserved). */
export interface ExpenseSection {
  title: string;
  date: string;
  totalSen: number;
  data: Expense[];
}

/** "Today" / "Yesterday" / "DD Mon" label for a `YYYY-MM-DD` date. */
function dateGroupLabel(dateStr: string, today: string): string {
  if (dateStr === today) return 'Today';
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
      last.totalSen += expense.amountSen;
    } else {
      sections.push({
        title,
        date: expense.date,
        totalSen: expense.amountSen,
        data: [expense],
      });
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
  onEditRow,
  onDeleteRow,
}: ExpenseListProps) {
  const accountName = (id: number | null): string | null =>
    id == null ? null : (accounts.find((a) => a.id === id)?.name ?? null);

  const sections = groupByDate(expenses);

  return (
    <View className="flex-1" testID="expenses-list">
      <FlatList
        data={sections}
        keyExtractor={(section, index) => `${section.date}-${index}`}
        renderItem={({ item: section }) => (
          <BentoCard className="mx-4 mb-3.5 p-0 overflow-hidden border border-border/60 bg-card rounded-2xl shadow-sm">
            {/* Date Header: Displays formatted date string on the left, daily total sum on the right */}
            <View className="flex-row items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border/60">
              <Text className="text-sm font-bold text-foreground tracking-tight">
                {section.title}
              </Text>
              <MoneyDisplay
                amountInSen={section.totalSen}
                size="sm"
                className="text-muted-foreground font-semibold"
              />
            </View>
            {/* Transaction Rows */}
            <View>
              {section.data.map((expense, idx) => (
                <View
                  key={expense.id}
                  className={idx > 0 ? 'border-t border-border/40' : ''}
                >
                  <ExpenseRow
                    expense={expense}
                    category={categories.find((c) => c.id === expense.categoryId)}
                    accountName={accountName(expense.accountId)}
                    onPress={() => onPressRow(expense)}
                    onEdit={onEditRow ? () => onEditRow(expense) : undefined}
                    onDelete={onDeleteRow ? () => onDeleteRow(expense) : undefined}
                  />
                </View>
              ))}
            </View>
          </BentoCard>
        )}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.muted}
            />
          ) : undefined
        }
        ListFooterComponent={
          hasMore ? (
            <ActivityIndicator
              style={styles.footer}
              testID="expense-list-footer"
            />
          ) : null
        }
        contentContainerStyle={styles.content}
        testID="expense-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120, paddingTop: spacing.sm },
  footer: { marginVertical: spacing.lg },
});

