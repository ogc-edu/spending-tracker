import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import type { Account, Category, Expense, ExpenseInstallment } from '@/db/schema';
import { DayHeader } from '@/components/ui/DayHeader';
import { ExpenseRow } from '@/components/ui/ExpenseRow';
import { formatSen } from '@/utils/money';
import { todayLocal } from '@/utils/dates';
import { useTheme } from '@/theme';

export interface ExpenseListProps {
  expenses: Expense[];
  categories: Category[];
  accounts: Account[];
  installments?: Record<number, ExpenseInstallment>;
  /** True while more batches exist (loaded rows < filtered count). */
  hasMore: boolean;
  onEndReached(): void;
  onRefresh?(): void;
  refreshing?: boolean;
  onPressRow(expense: Expense): void;
  onEditRow?(expense: Expense): void;
  onDeleteRow?(expense: Expense): void;
}

/** One dated section over the date-desc list. */
export interface ExpenseSection {
  title: string;
  date: string;
  totalSen: number;
  data: Expense[];
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Format date string YYYY-MM-DD into "TODAY · FRI 10 OCT" or "THU 9 OCT". */
export function formatDayHeaderTitle(dateStr: string, today: string = todayLocal()): string {
  const parts = dateStr.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y == null || m == null || d == null || isNaN(y) || isNaN(m) || isNaN(d)) {
    return dateStr;
  }
  const dateObj = new Date(y, m - 1, d);
  const weekday = WEEKDAYS[dateObj.getDay()] ?? '';
  const monthStr = (SHORT_MONTHS[m - 1] ?? '').toUpperCase();
  const dayStr = `${weekday} ${d} ${monthStr}`.trim();
  if (dateStr === today) {
    return `TODAY · ${dayStr}`;
  }
  return dayStr;
}

export function groupByDate(expenses: Expense[], today: string = todayLocal()): ExpenseSection[] {
  const sections: ExpenseSection[] = [];
  for (const expense of expenses) {
    const title = formatDayHeaderTitle(expense.date, today);
    const last = sections[sections.length - 1];
    if (last && last.date === expense.date) {
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
  installments = {},
  hasMore,
  onEndReached,
  onRefresh,
  refreshing = false,
  onPressRow,
}: ExpenseListProps) {
  const { colors } = useTheme();

  const sections = useMemo(() => groupByDate(expenses), [expenses]);

  return (
    <View style={styles.container} testID="expenses-list">
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderSectionHeader={({ section }) => (
          <DayHeader
            title={section.title}
            total={formatSen(section.totalSen)}
          />
        )}
        renderItem={({ item, index, section }) => {
          const isLast = index === section.data.length - 1;
          const category = categories.find((c) => c.id === item.categoryId);
          const account = accounts.find((a) => a.id === item.accountId);
          const inst = installments[item.id];
          const moSuffix = inst ? ` · ${inst.months} mo` : '';
          const meta = `${category?.name ?? 'Expense'} · ${account?.name ?? 'Account'}${moSuffix}`;

          return (
            <ExpenseRow
              categoryIndex={category?.id}
              categoryName={category?.name}
              note={item.description}
              meta={meta}
              amount={formatSen(item.amountSen)}
              isLast={isLast}
              onPress={() => onPressRow(item)}
              testID={`expense-row-${item.id}`}
            />
          );
        }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        stickySectionHeadersEnabled={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          ) : undefined
        }
        ListFooterComponent={
          hasMore ? (
            <ActivityIndicator
              style={styles.footer}
              color={colors.accent}
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
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 96,
  },
  footer: {
    marginVertical: 16,
  },
});
