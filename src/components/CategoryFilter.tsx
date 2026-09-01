/**
 * CategoryFilter (plan 006, F1) — horizontal single-select chip row:
 * "All" + the 12 seeded categories. Tapping the ACTIVE chip clears it back
 * to All (one tap clears); tapping another chip replaces the selection.
 * NO multi-select (F1 decision; multi-select is future). Presentational —
 * selection lives in uiStore via the screen's callbacks.
 */
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Category } from '@/db/schema';
import { categoryColor } from '@/components/categoryMeta';
import { colors, spacing, typography } from '@/theme';

export interface CategoryFilterProps {
  categories: Category[];
  /** null = All. */
  selectedId: number | null;
  onSelect(categoryId: number | null): void;
}

export function CategoryFilter({ categories, selectedId, onSelect }: CategoryFilterProps) {
  const handlePress = (categoryId: number | null) => {
    // Tap active chip → clear to All; tap another → replace (single-select).
    onSelect(categoryId === selectedId ? null : categoryId);
  };

  const allSelected = selectedId == null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      testID="category-filter"
    >
      <Pressable
        onPress={() => handlePress(null)}
        style={[styles.chip, allSelected && styles.chipSelected]}
        accessibilityRole="button"
        accessibilityState={{ selected: allSelected }}
        testID="category-filter-all"
      >
        <Text style={[styles.chipLabel, allSelected && styles.chipLabelSelected]}>All</Text>
      </Pressable>
      {categories.map((category) => {
        const selected = selectedId === category.id;
        return (
          <Pressable
            key={category.id}
            onPress={() => handlePress(category.id)}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={`category-filter-${category.id}`}
          >
            <Ionicons
              name={category.icon as never}
              size={14}
              color={selected ? colors.surface : categoryColor(category.id)}
            />
            <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{category.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontSize: typography.caption, color: colors.text, fontWeight: '600' },
  chipLabelSelected: { color: colors.surface },
});