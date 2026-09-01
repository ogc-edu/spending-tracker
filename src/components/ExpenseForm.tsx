/**
 * ExpenseForm (plan 005 UI) — add/edit expense form. React Hook Form + Zod
 * (the register/account-form pattern). Fields: amount (money string,
 * auto-focused for fast entry), category (chips grid from the seeded set),
 * account (chips with the current balance + a projected balance after save),
 * date (YYYY-MM-DD, defaults to today), description (optional, ≤200).
 *
 * The Zod schema here is the validation source of truth for the FORM (rejects
 * 0/negative/>2-decimal amounts, empty pickers, bad dates) — the service
 * re-validates the parsed sen input at its own boundary. Exported so tests
 * can `safeParse` it; `expenseToFormValues` is the edit-screen row→form
 * mapping (incl. the E7 read-only flag for linked expenses).
 */
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import type { Account, Category, Expense } from '@/db/schema';
import { DATE_RE, isValidDateStr, todayLocal } from '@/utils/dates';
import { formatSen, formatSenInput, parseMoneyToSen } from '@/utils/money';
import { balanceEffectFor } from '@/services/ExpenseService';
import type { ExpenseInput } from '@/repositories/types';
import { colors, spacing, typography } from '@/theme';
import { categoryColor } from './categoryMeta';

/** Matches parseMoneyToSen's MONEY_RE: whole ringgit, ≤2 decimal sen; rejects "12.", ".", "-5", "1,900". */
const MONEY_RE = /^\d+(\.[0-9]{1,2})?$/;

export const expenseFormSchema = z.object({
  amount: z
    .string()
    .regex(MONEY_RE, 'Enter a valid amount (up to 2 decimal places)')
    .refine(
      (value) => {
        try {
          return parseMoneyToSen(value) > 0;
        } catch {
          return false;
        }
      },
      { message: 'Amount must be greater than 0' },
    ),
  categoryId: z.number({ error: 'Choose a category' }).int().positive('Choose a category'),
  accountId: z.number({ error: 'Choose an account' }).int().positive('Choose an account'),
  date: z
    .string()
    .regex(DATE_RE, 'Use YYYY-MM-DD')
    .refine(isValidDateStr, 'Enter a real date'),
  description: z.string().trim().max(200, 'Description must be 200 characters or fewer'),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export interface ExpenseFormProps {
  categories: Category[];
  accounts: Account[];
  /** Partial prefill (new: today + last-used; edit: the row's values). */
  defaults?: Partial<ExpenseFormValues>;
  submitLabel?: string;
  onSubmit(input: ExpenseInput): Promise<void>;
  submitting: boolean;
  onCancel(): void;
}

export function ExpenseForm({
  categories,
  accounts,
  defaults,
  submitLabel = 'Save',
  onSubmit,
  submitting,
  onCancel,
}: ExpenseFormProps) {
  const {
    control,
    handleSubmit,
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { amount: '', description: '', date: todayLocal(), ...defaults },
  });

  // Live values for the projected-balance preview (SQLite is a source of truth;
  // this is pure UI state, recomputed on key).
  const watched = useWatch<ExpenseFormValues>({ control });
  const selectedAccount: Account | undefined =
    watched.accountId != null && watched.accountId > 0
      ? accounts.find((a) => a.id === watched.accountId)
      : undefined;

  // Projected balance after save (plan 005: the form shows it live).
  let projectedText: string | null = null;
  if (selectedAccount) {
    let amountSen = 0;
    try {
      amountSen = parseMoneyToSen(watched.amount ?? '');
    } catch {
      amountSen = 0;
    }
    const delta = balanceEffectFor(selectedAccount, amountSen);
    const projected = selectedAccount.balanceSen + delta;
    const label = selectedAccount.type === 'credit_card' ? 'Owed' : 'Balance';
    projectedText = `${label}: ${formatSen(selectedAccount.balanceSen)} → ${formatSen(projected)}`;
  }

  const onValid = (values: ExpenseFormValues) => {
    // Money regex guarantees parse success (identical grammar to MONEY_RE).
    const amountSen = parseMoneyToSen(values.amount);
    void onSubmit({
      amountSen,
      categoryId: values.categoryId,
      accountId: values.accountId,
      date: values.date,
      description: values.description,
    });
  };

  return (
    <View testID="expense-form">
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
              autoFocus
              editable={!submitting}
              testID="expense-form-amount"
            />
            {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="categoryId"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipWrap}>
              {categories.map((category) => {
                const selected = value === category.id;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => onChange(category.id)}
                    style={[styles.chip, selected && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`expense-form-category-${category.id}`}
                  >
                    <Ionicons
                      name={category.icon as never}
                      size={15}
                      color={selected ? colors.surface : categoryColor(category.id)}
                    />
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="accountId"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Account</Text>
            <View style={styles.chipWrap}>
              {accounts.map((account) => {
                const selected = value === account.id;
                return (
                  <Pressable
                    key={account.id}
                    onPress={() => onChange(account.id)}
                    style={[styles.chip, selected && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`expense-form-account-${account.id}`}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                      {account.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {projectedText ? <Text style={styles.projected}>{projectedText}</Text> : null}
            {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="date"
        render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={!submitting}
              testID="expense-form-date"
            />
            {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.multiline, error && styles.inputError]}
              placeholder="e.g. lunch with team"
              placeholderTextColor={colors.muted}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
              maxLength={200}
              editable={!submitting}
              testID="expense-form-description"
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
          testID="expense-form-submit"
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitLabel}>{submitLabel}</Text>}
        </Pressable>
        <Pressable
          onPress={onCancel}
          style={styles.cancel}
          disabled={submitting}
          accessibilityRole="button"
          testID="expense-form-cancel"
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Edit-screen mapping: expense row → form values (amount as an input string
 * for the money field). `readOnly` flags E7 linked expenses (auto-created
 * from a commitment payment) — the UI renders them without edit/delete.
 */
export function expenseToFormValues(expense: Expense): { values: ExpenseFormValues; readOnly: boolean } {
  return {
    readOnly: expense.commitmentPaymentId !== null,
    values: {
      amount: formatSenInput(expense.amountSen),
      categoryId: expense.categoryId,
      accountId: expense.accountId ?? 0,
      date: expense.date,
      description: expense.description,
    },
  };
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.lg },
  label: { fontSize: typography.body, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  fieldError: { marginTop: spacing.xs, color: colors.danger, fontSize: typography.caption },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontSize: typography.caption, color: colors.text, fontWeight: '600' },
  chipLabelSelected: { color: colors.surface },
  projected: { marginTop: spacing.sm, fontSize: typography.caption, color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
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