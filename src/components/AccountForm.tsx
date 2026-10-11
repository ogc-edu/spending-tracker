import React from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import type { Account } from '@/db/schema';
import { ACCOUNT_TYPES, type AccountInput, type AccountType } from '@/repositories/types';
import { parseMoneyToSen } from '@/utils/money';
import { ACCOUNT_TYPE_LABELS } from './accountMeta';
import { Chip } from '@/components/ui/Chip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextLinkButton } from '@/components/ui/TextLinkButton';
import { Stepper } from '@/components/ui/Stepper';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, 'Name required'),
  type: z.enum(ACCOUNT_TYPES),
  initialBalance: z
    .string()
    .regex(MONEY_RE, 'Enter a valid amount (up to 2 decimal places)'),
  statementDay: z.number().int().min(1).max(31).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;

export interface AccountFormProps {
  initialAccount?: Account | null;
  onSubmit: (input: AccountInput) => Promise<void>;
  submitting: boolean;
  onCancel: () => void;
  onDelete?: () => void;
}

export function AccountForm({
  initialAccount,
  onSubmit,
  submitting,
  onCancel,
  onDelete,
}: AccountFormProps) {
  const { colors } = useTheme();

  const isEditing = Boolean(initialAccount);
  const initialType: AccountType = (initialAccount?.type as AccountType) ?? 'cash';
  const initialBalanceStr = initialAccount
    ? (initialAccount.balanceSen / 100).toFixed(2).replace(/\.00$/, '')
    : '0';

  const {
    control,
    handleSubmit,
    setValue,
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema) as never,
    defaultValues: {
      name: initialAccount?.name ?? '',
      type: initialType,
      initialBalance: initialBalanceStr,
      statementDay: initialAccount?.statementDay ?? (initialType === 'paylater' ? 20 : 25),
      dueDay: initialAccount?.dueDay ?? (initialType === 'paylater' ? 31 : 15),
    },
  });

  const selectedType = useWatch({ control, name: 'type' });
  const isCredit = selectedType === 'credit_card' || selectedType === 'paylater';

  const onValid = (values: AccountFormValues) => {
    const initialBalanceSen = parseMoneyToSen(values.initialBalance);
    const statementDay = isCredit
      ? (values.statementDay ?? (values.type === 'paylater' ? 20 : 25))
      : null;
    const dueDay = isCredit
      ? (values.dueDay ?? (values.type === 'paylater' ? 31 : 15))
      : null;

    void onSubmit({
      name: values.name,
      type: values.type,
      initialBalanceSen,
      openingOwedSen: isCredit ? initialBalanceSen : 0,
      statementDay,
      dueDay,
    });
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.separator,
        },
      ]}
      testID="account-form"
    >
      <Text style={[styles.heading, { color: colors.text }]}>
        {isEditing ? 'Edit account' : 'Add account'}
      </Text>

      {/* Name Field */}
      <Controller
        control={control}
        name="name"
        render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.fill,
                  borderColor: error ? colors.danger : colors.separator,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. Maybank, Wallet, SPayLater"
              placeholderTextColor={colors.textTertiary}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={!submitting}
              testID="account-form-name"
            />
            {error ? (
              <Text style={[styles.fieldError, { color: colors.danger }]}>
                {error.message}
              </Text>
            ) : null}
          </View>
        )}
      />

      {/* Type Selector */}
      <Controller
        control={control}
        name="type"
        render={({ field: { value, onChange } }) => (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
            <View style={styles.chipWrap}>
              {ACCOUNT_TYPES.map((type) => {
                const selected = value === type;
                return (
                  <Chip
                    key={type}
                    label={ACCOUNT_TYPE_LABELS[type]}
                    selected={selected}
                    onPress={() => {
                      onChange(type);
                      if (type === 'paylater') {
                        setValue('statementDay', 20);
                        setValue('dueDay', 31);
                      } else if (type === 'credit_card') {
                        setValue('statementDay', 25);
                        setValue('dueDay', 15);
                      }
                    }}
                    testID={`account-form-type-${type}`}
                  />
                );
              })}
            </View>
          </View>
        )}
      />

      {/* Balance or Owed Now */}
      <Controller
        control={control}
        name="initialBalance"
        render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {isCredit ? 'Owed now (RM)' : 'Initial balance (RM)'}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.fill,
                  borderColor: error ? colors.danger : colors.separator,
                  color: colors.text,
                },
              ]}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={!submitting}
              testID="account-form-balance"
            />
            {error ? (
              <Text style={[styles.fieldError, { color: colors.danger }]}>
                {error.message}
              </Text>
            ) : null}
          </View>
        )}
      />

      {/* Billing Cycle Steppers for Credit Accounts */}
      {isCredit ? (
        <View style={styles.cycleSection}>
          <Text style={[styles.subheading, { color: colors.text }]}>Billing cycle</Text>

          <Controller
            control={control}
            name="statementDay"
            render={({ field: { value, onChange } }) => (
              <View style={styles.stepperRow}>
                <View style={styles.stepperLabelCol}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Statement day
                  </Text>
                  <Text style={[styles.hint, { color: colors.textTertiary }]}>
                    Day of month bill closes
                  </Text>
                </View>
                <Stepper
                  value={value ?? 20}
                  onChange={(v) => onChange(Math.round(v))}
                  min={1}
                  max={31}
                  step={1}
                  formatValue={(v) => String(Math.round(v))}
                  testID="account-form-statement-day"
                />
              </View>
            )}
          />

          <Controller
            control={control}
            name="dueDay"
            render={({ field: { value, onChange } }) => (
              <View style={styles.stepperRow}>
                <View style={styles.stepperLabelCol}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Due day
                  </Text>
                  <Text style={[styles.hint, { color: colors.textTertiary }]}>
                    31 = end of month
                  </Text>
                </View>
                <Stepper
                  value={value ?? 31}
                  onChange={(v) => onChange(Math.round(v))}
                  min={1}
                  max={31}
                  step={1}
                  formatValue={(v) => (Math.round(v) === 31 ? '31 (end)' : String(Math.round(v)))}
                  testID="account-form-due-day"
                />
              </View>
            )}
          />
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <PrimaryButton
          label={isEditing ? 'Save changes' : 'Add account'}
          loading={submitting}
          onPress={handleSubmit(onValid)}
          testID="account-form-submit"
        />
        <View style={styles.buttonRow}>
          <TextLinkButton
            label="Cancel"
            disabled={submitting}
            onPress={onCancel}
            testID="account-form-cancel"
          />
          {isEditing && onDelete ? (
            <TextLinkButton
              label="Delete account"
              textStyle={{ color: colors.danger }}
              disabled={submitting}
              onPress={onDelete}
              testID="account-form-delete"
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  heading: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  subheading: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    marginBottom: 4,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  hint: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: geistWeights.regular,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: geistWeights.medium,
    fontVariant: tabularNumsVariant,
    minHeight: 44,
  },
  fieldError: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.medium,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cycleSection: {
    borderTopWidth: 1,
    borderTopColor: 'transparent',
    gap: 10,
    paddingTop: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  stepperLabelCol: {
    flex: 1,
    gap: 2,
  },
  actions: {
    gap: 12,
    marginTop: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
});