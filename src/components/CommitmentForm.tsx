/**
 * CommitmentForm (plan 008 UI) — create a commitment. React Hook Form + Zod.
 *
 * Three shapes (fixed XOR ongoing XOR one-time, D4):
 *   - Installments (fixed monthly): total + payment + start date (+ optional
 *     end date). The engine derives N = ceil(total/payment) slots, last
 *     absorbs the remainder.
 *   - Ongoing monthly (rent/subscription): payment + start date. Infinite
 *     series derived within any query window.
 *   - One-time: payment + due date. A single slot on the due date.
 *
 * The commitment TYPE selector is the semantic category (PRD COM-1:
 * credit-card repayment, installment, BNPL, …); the shape selector above is
 * separate. Money fields are decimal strings converted to sen via
 * parseMoneyToSen on submit (the same pattern as BudgetForm/ExpenseForm); the
 * Zod schema is the single source of form validation and is exported so tests
 * can `safeParse` it.
 */
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { COMMITMENT_TYPES, type CommitmentInput } from '@/repositories/types';
import { isValidDateStr } from '@/utils/dates';
import { parseMoneyToSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';
import { COMMITMENT_TYPE_ICONS, COMMITMENT_TYPE_LABELS } from './commitmentMeta';

/** Matches parseMoneyToSen's MONEY_RE: whole ringgit, ≤2 decimal sen. */
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

export const COMMITMENT_KINDS = ['fixed', 'ongoing', 'one_time'] as const;
export type CommitmentKind = (typeof COMMITMENT_KINDS)[number];

export const commitmentFormSchema = z
  .object({
    name: z
      .string({ error: 'Name required' })
      .trim()
      .min(1, 'Name required')
      .max(100, 'Name must be 100 characters or fewer'),
    type: z.enum(COMMITMENT_TYPES, { error: 'Choose a type' }),
    kind: z.enum(COMMITMENT_KINDS, { error: 'Choose a schedule' }),
    total: z.string({ error: 'Total required' }),
    payment: z.string({ error: 'Payment required' }),
    startDate: z.string(),
    endDate: z.string(),
    dueDate: z.string(),
  })
  .superRefine((values, ctx) => {
    /** Attach an issue only if the field doesn't already have one (zod v4 runs all checks). */
    const addIssue = (path: string, message: string) => {
      if (!ctx.issues.some((i) => i.path?.[0] === path)) {
        ctx.addIssue({ code: 'custom', path: [path], message });
      }
    };
    const asSen = (value: string): number | null => {
      try {
        return parseMoneyToSen(value);
      } catch {
        return null;
      }
    };

    // Payment is required for every shape.
    if (!MONEY_RE.test(values.payment)) {
      addIssue('payment', 'Enter a valid payment amount (up to 2 decimal places)');
    } else if ((asSen(values.payment) ?? 0) <= 0) {
      addIssue('payment', 'Payment must be greater than 0');
    }

    if (values.kind === 'fixed') {
      if (!MONEY_RE.test(values.total)) {
        addIssue('total', 'Enter a valid total (up to 2 decimal places)');
      } else if ((asSen(values.total) ?? 0) <= 0) {
        addIssue('total', 'Total must be greater than 0');
      }
    }

    if (values.kind === 'fixed' || values.kind === 'ongoing') {
      if (!values.startDate) {
        addIssue('startDate', 'Start date required');
      } else if (!isValidDateStr(values.startDate)) {
        addIssue('startDate', 'Enter a real start date (YYYY-MM-DD)');
      }
    }

    if (values.kind === 'fixed' && values.endDate) {
      if (!isValidDateStr(values.endDate)) {
        addIssue('endDate', 'Enter a real end date (YYYY-MM-DD)');
      } else if (values.startDate && values.endDate < values.startDate) {
        addIssue('endDate', 'End date must not be before the start date');
      }
    }

    if (values.kind === 'one_time') {
      if (!values.dueDate) {
        addIssue('dueDate', 'Due date required');
      } else if (!isValidDateStr(values.dueDate)) {
        addIssue('dueDate', 'Enter a real due date (YYYY-MM-DD)');
      }
    }
  });

export type CommitmentFormValues = z.infer<typeof commitmentFormSchema>;

export const KIND_LABELS: Record<CommitmentKind, string> = {
  fixed: 'Installments',
  ongoing: 'Ongoing monthly',
  one_time: 'One-time',
};

export interface CommitmentFormProps {
  submitLabel?: string;
  onSubmit(input: CommitmentInput): Promise<void>;
  submitting: boolean;
  onCancel(): void;
}

function buildInput(values: CommitmentFormValues): CommitmentInput {
  const paymentSen = parseMoneyToSen(values.payment);
  const monthly = values.kind !== 'one_time';
  return {
    name: values.name,
    type: values.type,
    totalSen: values.kind === 'fixed' ? parseMoneyToSen(values.total) : null,
    paymentSen,
    frequency: monthly ? 'monthly' : 'one_time',
    // The service re-derives anchors: monthly → startDate; one-time → dueDate.
    startDate: monthly ? values.startDate : values.dueDate,
    endDate: values.kind === 'fixed' && values.endDate ? values.endDate : null,
    dueDate: monthly ? values.startDate : values.dueDate,
  };
}

export function CommitmentForm({ submitLabel = 'Add commitment', onSubmit, submitting, onCancel }: CommitmentFormProps) {
  const { control, handleSubmit } = useForm<CommitmentFormValues>({
    resolver: zodResolver(commitmentFormSchema),
    defaultValues: { type: 'installment', kind: 'fixed', total: '', payment: '', startDate: '', endDate: '', dueDate: '' },
  });

  const onValid = (values: CommitmentFormValues) => {
    void onSubmit(buildInput(values));
  };

  const renderField = (
    name: keyof CommitmentFormValues,
    label: string,
    props: { keyboardType?: 'decimal-pad' | 'default'; placeholder: string; optional?: boolean },
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <View style={styles.field}>
          <Text style={styles.label}>
            {label}
            {props.optional ? ' (optional)' : ''}
          </Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            keyboardType={props.keyboardType ?? 'default'}
            placeholder={props.placeholder}
            placeholderTextColor={colors.muted}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            editable={!submitting}
            testID={`commitment-form-${name}`}
          />
          {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
        </View>
      )}
    />
  );

  const renderChips = (
    name: 'type' | 'kind',
    options: { value: string; label: string; icon?: string }[],
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange }, fieldState: { error } }) => (
        <View style={styles.field}>
          <Text style={styles.label}>{name === 'kind' ? 'Schedule' : 'Type'}</Text>
          <View style={styles.chipWrap}>
            {options.map((option) => {
              const selected = value === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => onChange(option.value)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  testID={`commitment-form-${name}-${option.value}`}
                >
                  {option.icon ? (
                    <Ionicons name={option.icon as never} size={15} color={selected ? colors.surface : colors.muted} />
                  ) : null}
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
        </View>
      )}
    />
  );

  return (
    <View testID="commitment-form">
      {renderChips('kind', COMMITMENT_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] })))}
      {renderField('name', 'Name', { placeholder: 'e.g. Phone installment' })}
      {renderChips('type', COMMITMENT_TYPES.map((t) => ({ value: t, label: COMMITMENT_TYPE_LABELS[t], icon: COMMITMENT_TYPE_ICONS[t] })))}
      <Controller
        control={control}
        name="kind"
        render={({ field: { value } }) => (
          <>{value === 'fixed' ? renderField('total', 'Total amount (RM)', { keyboardType: 'decimal-pad', placeholder: '0.00' }) : null}</>
        )}
      />
      {renderField('payment', 'Payment amount (RM)', { keyboardType: 'decimal-pad', placeholder: '0.00' })}
      <Controller
        control={control}
        name="kind"
        render={({ field: { value } }) => (
          <>
            {value !== 'one_time' ? renderField('startDate', 'Start date', { placeholder: 'YYYY-MM-DD' }) : null}
            {value === 'fixed' ? renderField('endDate', 'End date', { placeholder: 'YYYY-MM-DD', optional: true }) : null}
            {value === 'one_time' ? renderField('dueDate', 'Due date', { placeholder: 'YYYY-MM-DD' }) : null}
          </>
        )}
      />

      <View style={styles.actions}>
        <Pressable
          onPress={handleSubmit(onValid)}
          style={[styles.submit, submitting && styles.buttonDisabled]}
          disabled={submitting}
          accessibilityRole="button"
          testID="commitment-form-submit"
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitLabel}>{submitLabel}</Text>}
        </Pressable>
        <Pressable
          onPress={onCancel}
          style={styles.cancel}
          disabled={submitting}
          accessibilityRole="button"
          testID="commitment-form-cancel"
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
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