/**
 * ExpenseForm (plan 005 UI) — add/edit expense form. React Hook Form + Zod
 * (the register/account-form pattern). Fields: amount (POS-style
 * sen-first MoneyInput, auto-focused for fast entry), category (chips grid from the seeded set),
 * account (chips with the current balance + a projected balance after save),
 * date (CalendarSheet picker, stored YYYY-MM-DD, defaults to today), description (optional, ≤200).
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
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import type { Account, Category, Expense } from '@/db/schema';
import { DATE_RE, formatDDMMYYYY, isValidDateStr, todayLocal } from '@/utils/dates';
import { formatSen, formatSenInput, parseMoneyToSen } from '@/utils/money';
import { balanceEffectFor } from '@/services/ExpenseService';
import type { ExpenseInput } from '@/repositories/types';
import { colors, spacing, typography } from '@/theme';
import { categoryColor } from './categoryMeta';
import { CategoryAddSheet } from './CategoryAddSheet';
import { CalendarSheet } from './CalendarSheet';
import { ConfirmSheet } from './ConfirmSheet';
import { useKeyboardAwareFocus } from './KeyboardAwareScrollView';
import { MoneyInput } from './MoneyInput';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';

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
  /** Category management (plan 016 follow-up): the "+" chip and long-press delete. */
  onCreateCategory(name: string, icon: string): Promise<Category>;
  onDeleteCategory(id: number): Promise<void>;
}

export function ExpenseForm({
  categories,
  accounts,
  defaults,
  submitLabel = 'Save',
  onSubmit,
  submitting,
  onCancel,
  onCreateCategory,
  onDeleteCategory,
}: ExpenseFormProps) {
  const {
    control,
    handleSubmit,
    setValue,
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { amount: '0.00', description: '', date: todayLocal(), ...defaults },
  });

  // Category management state (plan 016 follow-up): armed = long-press
  // revealed the delete badge; confirmDelete = the ConfirmSheet target.
  const [armedDelete, setArmedDelete] = useState<Category | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  /** Calendar visibility for the date field (pick, don't type). */
  const [dateOpen, setDateOpen] = useState(false);

  // Every text input reports its focus so the screen's scroller can lift it
  // above the keyboard (no-op when the form isn't inside one).
  const onInputFocus = useKeyboardAwareFocus();

  // The built-in catch-all 'Other' is hidden from the picker — its slot is
  // the "+" Add chip. (Deleting a category never touches existing rows.)
  const visibleCategories = categories.filter((c) => c.name.toLowerCase() !== 'other');

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
            <Text style={styles.label} nativeID="expense-form-label-amount">Amount</Text>
            {/* POS-style entry: digits fill in from the sen place (2,0,0 → RM2.00). */}
            <MoneyInput
              value={value}
              onChangeValue={onChange}
              onBlur={onBlur}
              onFocus={onInputFocus}
              autoFocus
              editable={!submitting}
              hasError={error !== undefined}
              accessibilityLabel="Amount in ringgit"
              accessibilityLabelledBy="expense-form-label-amount"
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
              {visibleCategories.map((category) => {
                const selected = value === category.id;
                const armed = armedDelete?.id === category.id;
                return (
                  <View key={category.id} style={[styles.chipSlot, armed && styles.chipArmed]}>
                    <Chip
                      label={category.name}
                      icon={category.icon as never}
                      iconColor={categoryColor(category.id)}
                      selected={selected}
                      onPress={() => {
                        if (armed) {
                          setArmedDelete(null); // tap again = disarm, never select
                          return;
                        }
                        onChange(category.id);
                      }}
                      onLongPress={() => setArmedDelete(armed ? null : category)}
                      delayLongPress={450}
                      testID={`expense-form-category-${category.id}`}
                    />
                    {armed ? (
                      <Pressable
                        onPress={() => setConfirmDelete(category)}
                        style={styles.minusBadge}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${category.name}`}
                        testID={`expense-form-category-delete-${category.id}`}
                      >
                        <Ionicons name="remove" size={14} color={colors.onAccent} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
              {/* The "+" chip replaces the built-in "Other" chip slot. */}
              <Chip
                label="Add"
                icon="add"
                iconColor={colors.accent}
                onPress={() => setAddOpen(true)}
                testID="expense-form-category-add"
              />
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
                  <Chip
                    key={account.id}
                    label={account.name}
                    selected={selected}
                    onPress={() => onChange(account.id)}
                    testID={`expense-form-account-${account.id}`}
                  />
                );
              })}
            </View>
            {projectedText ? <Text style={styles.projected}>{projectedText}</Text> : null}
            {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
          </View>
        )}
      />

      {/* Date is PICKED, never typed (the CommitmentForm pattern): the row opens
          the CalendarSheet, so no keyboard can cover it and the stored value is
          always a valid YYYY-MM-DD. */}
      <Controller
        control={control}
        name="date"
        render={({ field: { value }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Date</Text>
            <Pressable
              onPress={() => setDateOpen(true)}
              disabled={submitting}
              style={({ pressed }) => [styles.dateField, error && styles.inputError, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Date, ${value ? `${formatDDMMYYYY(value)}, picked` : 'not picked'}`}
              accessibilityHint="Opens a calendar"
              testID="expense-form-date"
            >
              <Ionicons name="calendar-outline" size={18} color={colors.muted} />
              <Text style={[styles.dateValue, !value && styles.datePlaceholder]}>
                {value ? formatDDMMYYYY(value) : 'Select a date'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
            </Pressable>
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
              accessibilityLabel="Description, optional"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              onFocus={onInputFocus}
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
        <Button
          label={submitLabel}
          variant="primary"
          flex
          busy={submitting}
          onPress={handleSubmit(onValid)}
          testID="expense-form-submit"
        />
        <Button
          label="Cancel"
          variant="secondary"
          flex
          disabled={submitting}
          onPress={onCancel}
          testID="expense-form-cancel"
        />
      </View>

      <CalendarSheet
        // Remount per open so the sheet anchors on the currently picked date.
        key={dateOpen ? 'date-open' : 'date-closed'}
        visible={dateOpen}
        title="Select date"
        value={watched.date ?? null}
        onSelect={(iso) => {
          setValue('date', iso, { shouldValidate: true });
          setDateOpen(false);
        }}
        onCancel={() => setDateOpen(false)} // dismiss leaves the date untouched
      />

      <CategoryAddSheet
        visible={addOpen}
        onSave={async (name, icon) => {
          const created = await onCreateCategory(name, icon);
          setValue('categoryId', created.id, { shouldValidate: true }); // auto-select the new category
          setAddOpen(false);
        }}
        onCancel={() => setAddOpen(false)}
      />

      <ConfirmSheet
        visible={confirmDelete !== null}
        title="Delete category"
        message={
          confirmDelete
            ? `"${confirmDelete.name}" is removed from the picker only — expenses and budgets that already use it are left unchanged.`
            : ''
        }
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={async () => {
          if (!confirmDelete) return;
          setDeleting(true);
          try {
            await onDeleteCategory(confirmDelete.id);
            if (watched.categoryId === confirmDelete.id && visibleCategories[0] !== undefined) {
              setValue('categoryId', visibleCategories[0].id, { shouldValidate: true });
            }
            setConfirmDelete(null);
          } finally {
            setDeleting(false);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
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
    minHeight: 44, // touch target (plan 016 a11y)
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    minHeight: 48, // touch target (plan 016 a11y)
  },
  dateValue: { flex: 1, fontSize: typography.body, color: colors.text, fontWeight: '600' },
  datePlaceholder: { color: colors.muted, fontWeight: '400' },
  pressed: { opacity: 0.7 },
  fieldError: { marginTop: spacing.xs, color: colors.danger, fontSize: typography.caption },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipSlot: { position: 'relative', borderRadius: 999 },
  chipArmed: { borderColor: colors.danger, borderWidth: 1.5, padding: 1 },
  minusBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  addChip: { borderStyle: 'dashed', backgroundColor: colors.background },
  addChipLabel: { color: colors.accent },
  chipLabel: { fontSize: typography.caption, color: colors.text, fontWeight: '600' },
  chipLabelSelected: { color: colors.surface },
  projected: {
    marginTop: spacing.sm,
    fontSize: typography.caption,
    color: colors.accent,
    fontWeight: '600',
    backgroundColor: colors.accentSoft,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
});