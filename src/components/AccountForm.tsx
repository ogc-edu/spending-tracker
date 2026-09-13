/**
 * AccountForm (plan 004 UI) — "Add account" form. React Hook Form + Zod
 * (matching the register screen pattern). Fields: name, type (segmented pickup),
 * initial balance (decimal input, sen conversion via parseMoneyToSen).
 *
 * The Zod schema here is the single source of validation truth for the form —
 * it rejects >2 decimals, negatives, empty names, and unknown account types
 * (exactly the plan's edge cases). Exported so tests can `safeParse` it.
 */
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { ACCOUNT_TYPES, type AccountInput } from '@/repositories/types';
import { parseMoneyToSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS } from './accountMeta';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';

/** Matches parseMoneyToSen's MONEY_RE: whole ringgit, ≤2 decimal sen; rejects "12.", ".", "-5", "1,900". */
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, 'Name required'),
  type: z.enum(ACCOUNT_TYPES),
  initialBalance: z
    .string()
    .regex(MONEY_RE, 'Enter a valid amount (up to 2 decimal places)'),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;

export function AccountForm({
  onSubmit,
  submitting,
  onCancel,
}: {
  onSubmit(input: AccountInput): Promise<void>;
  submitting: boolean;
  onCancel(): void;
}) {
  const {
    control,
    handleSubmit,
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { name: '', type: 'cash', initialBalance: '0' },
  });

  const onValid = (values: AccountFormValues) => {
    // Money regex guarantees parse success (identical grammar to MONEY_RE).
    const initialBalanceSen = parseMoneyToSen(values.initialBalance);
    void onSubmit({ name: values.name, type: values.type, initialBalanceSen });
  };

  return (
    <View style={styles.container} testID="account-form">
      <Controller
        control={control}
        name="name"
        render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="e.g. Maybank, Wallet"
              placeholderTextColor={colors.muted}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={!submitting}
              testID="account-form-name"
            />
            {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="type"
        render={({ field: { value, onChange } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.chipWrap}>
              {ACCOUNT_TYPES.map((type) => {
                const selected = value === type;
                return (
                  <Chip
                    key={type}
                    label={ACCOUNT_TYPE_LABELS[type]}
                    icon={ACCOUNT_TYPE_ICONS[type] as never}
                    iconColor={colors.muted}
                    selected={selected}
                    onPress={() => onChange(type)}
                    testID={`account-form-type-${type}`}
                  />
                );
              })}
            </View>
          </View>
        )}
      />

      <Controller
        control={control}
        name="initialBalance"
        render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Initial balance (RM)</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={!submitting}
              testID="account-form-balance"
            />
            {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
          </View>
        )}
      />

      <View style={styles.actions}>
        <Button
          label="Add account"
          variant="primary"
          flex
          busy={submitting}
          onPress={handleSubmit(onValid)}
          testID="account-form-submit"
        />
        <Button
          label="Cancel"
          variant="secondary"
          flex
          disabled={submitting}
          onPress={onCancel}
          testID="account-form-cancel"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  field: { marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  inputError: { borderColor: colors.danger },
  fieldError: { marginTop: spacing.xs, color: colors.danger, fontSize: typography.caption },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
});