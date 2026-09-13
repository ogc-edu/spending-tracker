/**
 * FilterBar (plan 006 §UI) — the Expenses tab's fixed filter section: a
 * debounced search input (300 ms, plan §UI) + the single-select category
 * chip row (F1) + the period presets / custom range picker. All state lives
 * in uiStore via the screen's callbacks; the search TextInput keeps a local
 * snapshot so typing stays instant while the STORE only changes after the
 * debounce fires (which resets offset and re-queries — SQLite is the source
 * of truth, A4).
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Category } from '@/db/schema';
import type { PeriodPreset } from '@/utils/dates';
import { CategoryFilter } from '@/components/CategoryFilter';
import { PeriodPicker } from '@/components/PeriodPicker';
import { colors, spacing, typography } from '@/theme';

/** Search debounce (plan §UI — 300 ms). */
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
}: FilterBarProps) {
  // Instant typing state; the STORE only updates after the debounce.
  const [searchInput, setSearchInput] = useState(search);
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
    <View style={styles.bar} testID="expense-filter-bar">
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={searchInput}
          onChangeText={handleSearchChange}
          placeholder="Search expenses"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="expense-search-input"
        />
        {searchInput.length > 0 ? (
          <Pressable onPress={clearSearch} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <CategoryFilter categories={categories} selectedId={categoryId} onSelect={onSelectCategory} />

      <PeriodPicker
        period={period}
        customFrom={customFrom}
        customTo={customTo}
        onSelect={onSelectPeriod}
        onApplyCustom={onApplyCustom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingTop: spacing.md },
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
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, fontSize: typography.body, color: colors.text, padding: 0, minHeight: 40 },
});