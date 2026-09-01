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
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { ACCOUNT_TYPES, type AccountInput } from '@/repositories/types';
import { parseMoneyToSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS } from './accountMeta';

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
            <View style={styles.segmented}>
              {ACCOUNT_TYPES.map((type) => {
                const selected = value === type;
                const pressedStyle =
                  ACCOUNT_TYPE_ICONS[type];
                return (
                  <Pressable
                    key={type}
                    onPress={() => onChange(type)}
                    style={[styles.segment, selected && styles.segmentSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`account-form-type-${type}`}
                  >
                    <Ionicons name={pressedStyle as never} size={16} color={selected ? colors.surface : colors.muted} />
                    <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
                      {ACCOUNT_TYPE_LABELS[type]}
                    </Text>
                  </Pressable>
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
        <Pressable
          onPress={handleSubmit(onValid)}
          style={[styles.submit, submitting && styles.buttonDisabled]}
          disabled={submitting}
          accessibilityRole="button"
          testID="account-form-submit"
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitLabel}>Add account</Text>}
        </Pressable>
        <Pressable
          onPress={onCancel}
          style={styles.cancel}
          disabled={submitting}
          accessibilityRole="button"
          testID="account-form-cancel"
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
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
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  segmentSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  segmentLabel: { fontSize: typography.caption, color: colors.muted, fontWeight: '600' },
  segmentLabelSelected: { color: colors.surface },
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