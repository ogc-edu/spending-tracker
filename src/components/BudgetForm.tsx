/**
 * BudgetForm (plan 007 UI) — set/edit a budget amount (overall or one
 * category). React Hook Form + Zod, mirroring the AccountForm pattern: a
 * single money field (decimal-pad), converted to integer sen via
 * parseMoneyToSen (plan 004 util) on submit. The Zod schema is the single
 * source of form validation — it rejects >2 decimals, negatives, empty
 * strings, and amounts that parse to 0 sen (budgets must be > 0, plan 007
 * §Security). Exported so tests can `safeParse` it, matching the
 * accountFormSchema test pattern.
 */
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { parseMoneyToSen, formatSenInput } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

/** Matches parseMoneyToSen's MONEY_RE: whole ringgit, ≤2 decimal sen; rejects "12.", ".", "-5", "1,900". */
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

export const budgetFormSchema = z.object({
  amount: z
    .string()
    .regex(MONEY_RE, 'Enter a valid amount (up to 2 decimal places)')
    .refine((value) => {
      // zod v4 runs every check (a failed regex does not abort), so
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
  /** Card heading, e.g. "Monthly budget" or "Food budget". */
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
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: { amount: initialAmountSen != null ? formatSenInput(initialAmountSen) : '' },
  });

  const onValid = (values: BudgetFormValues) => {
    // Money regex guarantees parse success (identical grammar to MONEY_RE).
    onSubmit(parseMoneyToSen(values.amount));
  };

  return (
    <View style={styles.container} testID="budget-form">
      <Text style={styles.title}>{title}</Text>
      <Controller
        control={control}
        name="amount"
        render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Amount (RM)</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
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
            {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
          </View>
        )}
      />

      <View style={styles.actions}>
        <Pressable
          onPress={handleSubmit(onValid)}
          style={[styles.submit, submitting && styles.buttonDisabled]}
          disabled={submitting}
          accessibilityRole="button"
          testID="budget-form-submit"
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitLabel}>{submitLabel}</Text>}
        </Pressable>
        <Pressable
          onPress={onCancel}
          style={styles.cancel}
          disabled={submitting}
          accessibilityRole="button"
          testID="budget-form-cancel"
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  field: { marginBottom: spacing.lg },
  label: { fontSize: typography.body, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.moneySmall,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { marginTop: spacing.xs, color: colors.danger, fontSize: typography.caption },
  actions: { flexDirection: 'row', gap: spacing.md },
  submit: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  submitLabel: { color: '#fff', fontSize: typography.emphasis, fontWeight: '600' },
  cancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelLabel: { color: colors.muted, fontSize: typography.emphasis, fontWeight: '600' },
});