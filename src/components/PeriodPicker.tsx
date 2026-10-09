/**
 * PeriodPicker (plan 006; plan 017 — shared Chip) — date-range filter: five
 * presets (Today / This Week / This Month / Last Month / All) + a Custom
 * from/to pair. Week starts Monday (local calendar, plan §UI). Interaction
 * matches the category chips: tapping the ACTIVE preset clears to All;
 * tapping another replaces it. The custom inputs mount only while
 * period === 'custom' and prefill from the applied custom range (or this
 * month → today the first time). A custom range with from > to is rejected
 * here AND at the service boundary (plan §Edge cases). Preset chips are
 * ≥44 pt touch targets via the shared Chip.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PeriodPreset } from '@/utils/dates';
import { DATE_RE, isValidDateStr, monthStartDate, PERIOD_PRESETS, todayLocal } from '@/utils/dates';
import { Chip } from '@/components/ui/Chip';
import { colors, spacing, typography } from '@/theme';

const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: 'Today',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  all: 'All',
  custom: 'Custom',
};

export interface PeriodPickerProps {
  period: PeriodPreset;
  /** Applied custom range ('' = never applied). */
  customFrom: string;
  customTo: string;
  onSelect(period: PeriodPreset): void;
  /** Both dates valid and from ≤ to (validated here first). */
  onApplyCustom(from: string, to: string): void;
}

export function PeriodPicker({ period, customFrom, customTo, onSelect, onApplyCustom }: PeriodPickerProps) {
  const customActive = period === 'custom';
  const [fromInput, setFromInput] = useState(
    () => customFrom || monthStartDate(new Date().getFullYear(), new Date().getMonth() + 1),
  );
  const [toInput, setToInput] = useState(() => customTo || todayLocal());
  const [customError, setCustomError] = useState<string | null>(null);

  const handlePreset = (preset: PeriodPreset) => {
    setCustomError(null);
    // Tap the ACTIVE preset → clear to All (one tap clears, plan §Requirements).
    onSelect(preset === period && preset !== 'all' && preset !== 'custom' ? 'all' : preset);
  };

  const applyCustom = () => {
    const from = fromInput.trim();
    const to = toInput.trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      setCustomError('Use YYYY-MM-DD for both dates');
      return;
    }
    if (!isValidDateStr(from) || !isValidDateStr(to)) {
      setCustomError('Enter a real date');
      return;
    }
    if (from > to) {
      setCustomError('From date must not be after To date');
      return;
    }
    setCustomError(null);
    onApplyCustom(from, to);
  };

  return (
    <View testID="period-picker">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {PERIOD_PRESETS.map((preset) => (
          <Chip
            key={preset}
            label={PRESET_LABELS[preset]}
            selected={period === preset}
            onPress={() => handlePreset(preset)}
            testID={`period-${preset}`}
          />
        ))}
      </ScrollView>

      {customActive ? (
        <View style={styles.customBox} testID="custom-range">
          <View style={styles.customFields}>
            <TextInput
              style={styles.dateInput}
              value={fromInput}
              onChangeText={(text) => {
                setFromInput(text);
                setCustomError(null);
              }}
              placeholder="From YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              testID="custom-range-from"
            />
            <Text style={styles.customDash}>→</Text>
            <TextInput
              style={styles.dateInput}
              value={toInput}
              onChangeText={(text) => {
                setToInput(text);
                setCustomError(null);
              }}
              placeholder="To YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              testID="custom-range-to"
            />
            <Pressable
              onPress={applyCustom}
              style={({ pressed }) => (pressed ? [styles.applyButton, styles.pressed] : styles.applyButton)}
              accessibilityRole="button"
              testID="custom-range-apply"
            >
              <Text style={styles.applyLabel}>Apply</Text>
            </Pressable>
          </View>
          {customError ? (
            <Text style={styles.customError} testID="custom-range-error">
              {customError}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  customBox: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  customFields: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  customDash: { color: colors.muted, fontSize: typography.body },
  applyButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accentSoft,
  },
  pressed: { opacity: 0.7 },
  applyLabel: { color: colors.accent, fontSize: typography.caption, fontWeight: '700' },
  customError: { marginTop: spacing.xs, color: colors.danger, fontSize: typography.caption },
});
