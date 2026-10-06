/**
 * FilterBar (Plan 004 — Single-axis horizontal filter dock)
 *
 * Integrated search bar + horizontal filter carousels:
 * - Search bar (`testID="expense-search-input"`) with 300 ms debounce.
 * - Date presets: Today, This Week, This Month, Last Month, All, Custom Date.
 * - Category chips with icon glyphs + payment account selector.
 * - Minimum 44px touch targets via TouchTarget / Chip.
 * - Container retains `testID="expense-filter-bar"`.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Account, Category } from '@/db/schema';
import type { PeriodPreset } from '@/utils/dates';
import { CategoryFilter } from '@/components/CategoryFilter';
import { PeriodPicker } from '@/components/PeriodPicker';
import { Sheet } from '@/components/ui/Sheet';
import { TouchTarget } from '@/components/ui/TouchTarget';
import { colors, spacing, typography } from '@/theme';
import { cn } from '@/lib/utils';

/** Search debounce (300 ms). */
const SEARCH_DEBOUNCE_MS = 300;

export interface FilterBarProps {
  /** Store value — the TextInput snapshot initializes from it once. */
  search: string;
  /** Called ONLY after the 300 ms debounce (and immediately on clear). */
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
  accounts,
  selectedAccountId,
  onSelectAccount,
}: FilterBarProps) {
  // Instant typing state; the STORE only updates after the debounce.
  const [searchInput, setSearchInput] = useState(search);
  const [accountSheetVisible, setAccountSheetVisible] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (text: string) => {
    setSearchInput(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(text.trim());
    }, SEARCH_DEBOUNCE_MS);
  };

  const clearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchInput('');
    onSearchChange('');
  };

  // Clear a pending debounce on unmount (no setState — lint-safe).
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return (
    <View className="pt-2 bg-background border-b border-border/40" style={styles.bar} testID="expense-filter-bar">
      {/* Search Bar (44px min height touch target) */}
      <View
        className="flex-row items-center gap-2 border border-border/60 rounded-xl bg-card min-h-[44px] py-1 px-3 mx-4 mb-2 shadow-sm"
        style={styles.searchBox}
      >
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput
          className="flex-1 text-base text-foreground p-0 min-h-[40px]"
          style={styles.searchInput}
          value={searchInput}
          onChangeText={handleSearchChange}
          placeholder="Search payee or notes..."
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="expense-search-input"
        />
        {searchInput.length > 0 ? (
          <TouchTarget
            minHeight={36}
            onPress={clearSearch}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchTarget>
        ) : null}
      </View>

      {/* Date Presets Row (Today, This Week, This Month, Last Month, All, Custom) */}
      <PeriodPicker
        period={period}
        customFrom={customFrom}
        customTo={customTo}
        onSelect={onSelectPeriod}
        onApplyCustom={onApplyCustom}
      />

      {/* Category Chips with Glyphs + Account Selector Chip */}
      <CategoryFilter
        categories={categories}
        selectedId={categoryId}
        onSelect={onSelectCategory}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onOpenAccountSheet={() => setAccountSheetVisible(true)}
      />

      {/* Payment Account Selector Modal Sheet */}
      {accounts && accounts.length > 0 ? (
        <Sheet
          visible={accountSheetVisible}
          onClose={() => setAccountSheetVisible(false)}
          title="Filter by Account"
          showClose
          closeLabel="Close account filter"
          cardTestID="account-filter-sheet"
        >
          <View className="py-2 gap-2">
            <Pressable
              onPress={() => {
                onSelectAccount?.(null);
                setAccountSheetVisible(false);
              }}
              className={cn(
                'flex-row items-center justify-between px-4 py-3 rounded-xl border min-h-[48px]',
                selectedAccountId == null
                  ? 'bg-primary/10 border-primary'
                  : 'bg-card border-border active:bg-muted/40'
              )}
              accessibilityRole="button"
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="wallet-outline" size={20} color={colors.accent} />
                <Text className="text-base font-semibold text-foreground">All Accounts</Text>
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
                  className={cn(
                    'flex-row items-center justify-between px-4 py-3 rounded-xl border min-h-[48px]',
                    isSelected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-card border-border active:bg-muted/40'
                  )}
                  accessibilityRole="button"
                  testID={`account-filter-item-${acc.id}`}
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name={acc.type === 'credit_card' ? 'card-outline' : 'business-outline'}
                      size={20}
                      color={colors.muted}
                    />
                    <View>
                      <Text className="text-base font-semibold text-foreground">{acc.name}</Text>
                      <Text className="text-xs text-muted-foreground uppercase">{acc.type.replace('_', ' ')}</Text>
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingTop: spacing.xs },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xs,
  },
  searchInput: { flex: 1, fontSize: typography.body, color: colors.text, padding: 0, minHeight: 40 },
});