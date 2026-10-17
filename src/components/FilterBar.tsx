import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Account, Category } from '@/db/schema';
import type { PeriodPreset } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { accountShades, geistWeights, tabularNumsVariant, useTheme } from '@/theme';
import { AccountSwatch } from '@/components/ui/AccountSwatch';
import { CategoryTile } from '@/components/ui/CategoryTile';
import { FilterPill } from '@/components/ui/FilterPill';
import { SearchField } from '@/components/ui/SearchField';
import { Sheet } from '@/components/ui/Sheet';
import { CalendarSheet } from '@/components/CalendarSheet';

const SEARCH_DEBOUNCE_MS = 300;

export interface FilterBarProps {
  search: string;
  onSearchChange(text: string): void;
  categories: Category[];
  categoryId: number | null;
  onSelectCategory(categoryId: number | null): void;
  period: PeriodPreset;
  customFrom: string;
  customTo: string;
  onSelectPeriod(period: PeriodPreset): void;
  onApplyCustom(from: string, to: string): void;
  accounts?: Account[];
  selectedAccountId?: number | null;
  onSelectAccount?(accountId: number | null): void;
}

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  thisMonth: 'This month',
  thisWeek: 'This week',
  today: 'Today',
  lastMonth: 'Last month',
  all: 'All time',
  custom: 'Custom range',
};

function formatAccountKind(type: string): string {
  switch (type) {
    case 'bank':
      return 'Bank';
    case 'cash':
      return 'Wallet';
    case 'credit_card':
      return 'Credit';
    case 'paylater':
      return 'Pay later';
    case 'ewallet':
      return 'eWallet';
    default:
      return type;
  }
}

export function FilterBar({
  search,
  onSearchChange,
  categories,
  categoryId,
  onSelectCategory,
  period,
  customFrom,
  customTo,
  onSelectPeriod,
  onApplyCustom,
  accounts = [],
  selectedAccountId,
  onSelectAccount,
}: FilterBarProps) {
  const { colors } = useTheme();
  const [searchInput, setSearchInput] = useState(search);
  const [prevSearch, setPrevSearch] = useState(search);
  const [periodSheetVisible, setPeriodSheetVisible] = useState(false);
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [accountSheetVisible, setAccountSheetVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync prop changes into local input if prop is cleared/reset from outside
  if (search !== prevSearch) {
    setPrevSearch(search);
    setSearchInput(search);
  }

  const handleSearchChange = (text: string) => {
    setSearchInput(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(text.trim());
    }, SEARCH_DEBOUNCE_MS);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  // Period pill label
  let periodPillLabel = PERIOD_LABELS[period] ?? 'Period';
  if (period === 'custom' && customFrom && customTo) {
    periodPillLabel = `${customFrom} – ${customTo}`;
  }

  // Category pill label
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const categoryPillLabel = selectedCategory ? selectedCategory.name : 'All categories';

  // Account pill label
  const shades = accountShades(accounts);
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const accountPillLabel = selectedAccount ? selectedAccount.name : 'All accounts';

  return (
    <View style={styles.container} testID="expense-filter-bar">
      {/* Search notes field */}
      <View style={styles.searchWrap}>
        <SearchField
          value={searchInput}
          onChangeText={handleSearchChange}
          placeholder="Search notes"
          accessibilityLabel="Search expenses"
          testID="expense-search-input"
        />
      </View>

      {/* FilterPills row */}
      <View style={styles.pillsRow}>
        <FilterPill
          label={periodPillLabel}
          selected={period !== 'all'}
          onPress={() => setPeriodSheetVisible(true)}
          testID="filter-pill-period"
        />
        <FilterPill
          label={categoryPillLabel}
          selected={categoryId != null}
          onPress={() => setCategorySheetVisible(true)}
          testID="filter-pill-category"
        />
        <FilterPill
          label={accountPillLabel}
          selected={selectedAccountId != null}
          onPress={() => setAccountSheetVisible(true)}
          testID="filter-pill-account"
        />
      </View>

      {/* Period Picker Sheet */}
      <Sheet
        visible={periodSheetVisible}
        onClose={() => setPeriodSheetVisible(false)}
        title="Period"
        showClose
        closeLabel="Close period filter"
        cardTestID="period-filter-sheet"
      >
        <View style={styles.sheetContent}>
          {(['thisMonth', 'thisWeek', 'today', 'lastMonth', 'all'] as const).map((p) => {
            const isSelected = period === p;
            return (
              <Pressable
                key={p}
                onPress={() => {
                  onSelectPeriod(p);
                  setPeriodSheetVisible(false);
                }}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: isSelected ? colors.selectedBg : colors.fill,
                    borderColor: isSelected ? colors.accent : colors.separator,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color: colors.text,
                      fontFamily: isSelected ? geistWeights.semiBold : geistWeights.medium,
                      fontWeight: isSelected ? '600' : '500',
                    },
                  ]}
                >
                  {PERIOD_LABELS[p]}
                </Text>
                {isSelected ? (
                  <Ionicons name="checkmark" size={18} color={colors.accent} />
                ) : null}
              </Pressable>
            );
          })}

          {/* Custom Date Range Option */}
          <Pressable
            onPress={() => {
              setPeriodSheetVisible(false);
              setCalendarVisible(true);
            }}
            style={[
              styles.optionRow,
              {
                backgroundColor: period === 'custom' ? colors.selectedBg : colors.fill,
                borderColor: period === 'custom' ? colors.accent : colors.separator,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: period === 'custom' }}
          >
            <Text
              style={[
                styles.optionLabel,
                {
                  color: colors.text,
                  fontFamily: period === 'custom' ? geistWeights.semiBold : geistWeights.medium,
                  fontWeight: period === 'custom' ? '600' : '500',
                },
              ]}
            >
              {period === 'custom' && customFrom && customTo
                ? `Custom: ${customFrom} – ${customTo}`
                : 'Custom range…'}
            </Text>
            {period === 'custom' ? (
              <Ionicons name="checkmark" size={18} color={colors.accent} />
            ) : null}
          </Pressable>
        </View>
      </Sheet>

      {/* Category Picker Sheet */}
      <Sheet
        visible={categorySheetVisible}
        onClose={() => setCategorySheetVisible(false)}
        title="Category"
        showClose
        closeLabel="Close category filter"
        cardTestID="category-filter-sheet"
      >
        <View style={styles.sheetContent}>
          <Pressable
            onPress={() => {
              onSelectCategory(null);
              setCategorySheetVisible(false);
            }}
            style={[
              styles.optionRow,
              {
                backgroundColor: categoryId == null ? colors.selectedBg : colors.fill,
                borderColor: categoryId == null ? colors.accent : colors.separator,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: categoryId == null }}
            testID="category-filter-all"
          >
            <View style={styles.rowLead}>
              <Ionicons name="grid-outline" size={20} color={colors.accent} />
              <Text
                style={[
                  styles.optionLabel,
                  {
                    color: colors.text,
                    fontFamily: categoryId == null ? geistWeights.semiBold : geistWeights.medium,
                    fontWeight: categoryId == null ? '600' : '500',
                  },
                ]}
              >
                All categories
              </Text>
            </View>
            {categoryId == null ? (
              <Ionicons name="checkmark" size={18} color={colors.accent} />
            ) : null}
          </Pressable>

          {categories.map((cat) => {
            const isSelected = categoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  onSelectCategory(isSelected ? null : cat.id);
                  setCategorySheetVisible(false);
                }}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: isSelected ? colors.selectedBg : colors.fill,
                    borderColor: isSelected ? colors.accent : colors.separator,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                testID={`category-filter-${cat.id}`}
              >
                <View style={styles.rowLead}>
                  <CategoryTile categoryIndex={cat.id} name={cat.name} />
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: colors.text,
                        fontFamily: isSelected ? geistWeights.semiBold : geistWeights.medium,
                        fontWeight: isSelected ? '600' : '500',
                      },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark" size={18} color={colors.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      {/* Account Picker Sheet */}
      <Sheet
        visible={accountSheetVisible}
        onClose={() => setAccountSheetVisible(false)}
        title="Account"
        showClose
        closeLabel="Close account filter"
        cardTestID="account-filter-sheet"
      >
        <View style={styles.sheetContent}>
          <Pressable
            onPress={() => {
              onSelectAccount?.(null);
              setAccountSheetVisible(false);
            }}
            style={[
              styles.optionRow,
              {
                backgroundColor: selectedAccountId == null ? colors.selectedBg : colors.fill,
                borderColor: selectedAccountId == null ? colors.accent : colors.separator,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedAccountId == null }}
          >
            <View style={styles.rowLead}>
              <Ionicons name="wallet-outline" size={20} color={colors.accent} />
              <Text
                style={[
                  styles.optionLabel,
                  {
                    color: colors.text,
                    fontFamily: selectedAccountId == null ? geistWeights.semiBold : geistWeights.medium,
                    fontWeight: selectedAccountId == null ? '600' : '500',
                  },
                ]}
              >
                All accounts
              </Text>
            </View>
            {selectedAccountId == null ? (
              <Ionicons name="checkmark" size={18} color={colors.accent} />
            ) : null}
          </Pressable>

          {accounts.map((acc) => {
            const isSelected = selectedAccountId === acc.id;
            return (
              <Pressable
                key={acc.id}
                onPress={() => {
                  onSelectAccount?.(isSelected ? null : acc.id);
                  setAccountSheetVisible(false);
                }}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: isSelected ? colors.selectedBg : colors.fill,
                    borderColor: isSelected ? colors.accent : colors.separator,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                testID={`account-filter-item-${acc.id}`}
              >
                <View style={styles.rowLead}>
                  <AccountSwatch accountType={acc.type as never} shade={shades.get(acc.id)} />
                  <View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.optionLabel,
                        {
                          color: colors.text,
                          fontFamily: isSelected ? geistWeights.semiBold : geistWeights.medium,
                          fontWeight: isSelected ? '600' : '500',
                        },
                      ]}
                    >
                      {acc.name}
                    </Text>
                    <Text style={[styles.optionMeta, { color: colors.textSecondary }]}>
                      {formatAccountKind(acc.type)} · {formatSen(acc.balanceSen)}
                    </Text>
                  </View>
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark" size={18} color={colors.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      {/* CalendarSheet for custom range picker */}
      <CalendarSheet
        visible={calendarVisible}
        title="Custom date range"
        value={customFrom || undefined}
        onSelect={(iso) => {
          onApplyCustom(iso, iso);
          setCalendarVisible(false);
        }}
        onCancel={() => setCalendarVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  searchWrap: {
    paddingHorizontal: 0,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sheetContent: {
    paddingVertical: 8,
    gap: 8,
    maxHeight: 380,
  },
  optionRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  optionMeta: {
    fontSize: 11,
    lineHeight: 14,
    fontVariant: tabularNumsVariant,
  },
});