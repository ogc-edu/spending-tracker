/**
 * BudgetForm (Plan 005 — Budget Limit Entry Sheet)
 *
 * Native gesture-driven entry form for category & monthly budget caps:
 * - Sen input with numeric decimal pad and tabular monospace alignment.
 * - Quick percentage presets: +10%, +25%, and Reset.
 * - Single source of validation via Zod (budgetFormSchema).
 * - Retains and exposes test contracts:
 *     testID="budget-form"
 *     testID="category-limit-input"
 *     testID="budget-form-amount"
 *     testID="budget-form-submit"
 *     testID="budget-form-cancel"
 */
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { parseMoneyToSen, formatSenInput } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/Chip';

/** Matches parseMoneyToSen's MONEY_RE: whole ringgit, ≤2 decimal sen; rejects "12.", ".", "-5", "1,900". */
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

export const budgetFormSchema = z.object({
  amount: z
    .string()
    .regex(MONEY_RE, 'Enter a valid amount (up to 2 decimal places)')
    .refine((value) => {
      // zod runs every check (a failed regex does not abort), so
      // parseMoneyToSen can be handed a string that already failed the regex
      // and would THROW — treat that as invalid, never crash the parse.
      try {
        return parseMoneyToSen(value) > 0;
      } catch {
        return false;
      }
    }, 'Amount must be greater than 0'),
});

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export function BudgetForm({
  title,
  initialAmountSen,
  submitLabel,
  onSubmit,
  submitting,
  onCancel,
}: {
  /** Card heading, e.g. "Monthly budget" or "Food & Dining budget". */
  title: string;
  /** Prefill for editing; null = fresh form ("0.00" default). */
  initialAmountSen?: number | null;
  submitLabel: string;
  /** Receives the parsed integer sen — never a string. */
  onSubmit(amountSen: number): void;
  submitting: boolean;
  onCancel(): void;
}) {
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: { amount: initialAmountSen != null ? formatSenInput(initialAmountSen) : '' },
  });

  const onValid = (values: BudgetFormValues) => {
    // Money regex guarantees parse success.
    onSubmit(parseMoneyToSen(values.amount));
  };

  const applyPreset = (factor: number) => {
    let baseSen = 0;
    try {
      const cur = getValues('amount');
      if (cur && cur.trim().length > 0) {
        baseSen = parseMoneyToSen(cur);
      } else if (initialAmountSen != null) {
        baseSen = initialAmountSen;
      }
    } catch {
      baseSen = initialAmountSen ?? 0;
    }
    if (baseSen > 0) {
      const nextSen = Math.round(baseSen * factor);
      setValue('amount', formatSenInput(nextSen), { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleReset = () => {
    setValue(
      'amount',
      initialAmountSen != null ? formatSenInput(initialAmountSen) : '',
      { shouldValidate: true, shouldDirty: true }
    );
  };

  return (
    <View style={styles.container} testID="budget-form">
      <Text style={styles.title}>{title}</Text>

      {/* Quick allocation presets */}
      <View className="flex-row items-center gap-2 mb-4">
        <Chip
          label="+10%"
          onPress={() => applyPreset(1.10)}
          disabled={submitting}
          testID="budget-preset-10"
        />
        <Chip
          label="+25%"
          onPress={() => applyPreset(1.25)}
          disabled={submitting}
          testID="budget-preset-25"
        />
        <Chip
          label="Reset"
          onPress={handleReset}
          disabled={submitting}
          testID="budget-preset-reset"
        />
      </View>

      <Controller
        control={control}
        name="amount"
        render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Amount (RM)</Text>
            <View
              testID="category-limit-input"
              accessibilityLabel="Category limit input"
              className="w-full"
            >
              <Input
                className="min-h-[48px] h-12 rounded-xl bg-background border border-border px-4 text-base font-semibold font-mono"
                style={{ fontVariant: ['tabular-nums'] }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                editable={!submitting}
                autoFocus
                testID="budget-form-amount"
              />
            </View>
            {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
          </View>
        )}
      />

      <View style={styles.actions}>
        <Button
          label={submitLabel}
          variant="primary"
          flex
          busy={submitting}
          onPress={handleSubmit(onValid)}
          testID="budget-form-submit"
        />
        <Button
          label="Cancel"
          variant="secondary"
          flex
          disabled={submitting}
          onPress={onCancel}
          testID="budget-form-cancel"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  field: { marginBottom: spacing.lg },
  label: { fontSize: typography.body, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  fieldError: { marginTop: spacing.xs, color: colors.danger, fontSize: typography.caption },
  actions: { flexDirection: 'row', gap: spacing.md },
});