/**
 * CategoryFilter (plan 006, F1; plan 017 — shared Chip) — horizontal
 * single-select chip row: "All" + the 12 seeded categories. Tapping the
 * ACTIVE chip clears it back to All (one tap clears); tapping another chip
 * replaces the selection. NO multi-select (F1 decision; multi-select is
 * future). Presentational — selection lives in uiStore via the screen's
 * callbacks. Chips are ≥44 pt touch targets via the shared Chip.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Account, Category } from '@/db/schema';
import { categoryColor } from '@/components/categoryMeta';
import { Chip } from '@/components/ui/Chip';
import { spacing } from '@/theme';

export interface CategoryFilterProps {
  categories: Category[];
  /** null = All. */
  selectedId: number | null;
  onSelect(categoryId: number | null): void;
  accounts?: Account[];
  selectedAccountId?: number | null;
  onOpenAccountSheet?(): void;
}

export function CategoryFilter({
  categories,
  selectedId,
  onSelect,
  accounts,
  selectedAccountId,
  onOpenAccountSheet,
}: CategoryFilterProps) {
  const handlePress = (categoryId: number | null) => {
    // Tap active chip → clear to All; tap another → replace (single-select).
    onSelect(categoryId === selectedId ? null : categoryId);
  };

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      testID="category-filter"
    >
      <Chip
        label="All"
        selected={selectedId == null}
        onPress={() => handlePress(null)}
        testID="category-filter-all"
      />
      {categories.map((category) => (
        <Chip
          key={category.id}
          label={category.name}
          icon={category.icon as never}
          iconColor={categoryColor(category.id)}
          selected={selectedId === category.id}
          onPress={() => handlePress(category.id)}
          testID={`category-filter-${category.id}`}
        />
      ))}
      {accounts && accounts.length > 0 && onOpenAccountSheet ? (
        <>
          <View className="w-px h-6 bg-border mx-1 self-center" />
          <Chip
            label={selectedAccount ? selectedAccount.name : 'Account'}
            icon="wallet-outline"
            selected={selectedAccountId != null}
            onPress={onOpenAccountSheet}
            testID="account-filter-chip"
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
});
