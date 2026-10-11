import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import type { Account, Category, Expense } from '@/db/schema';
import { billCycleForDate, monthShift, splitInstallment, type InstallmentPart } from '@/engine/creditBills';
import { DATE_RE, isValidDateStr, todayLocal, toLocalDateString } from '@/utils/dates';
import {
  formatSen,
  formatSenInput,
  parseMoneyToSen,
  senFromInputText,
  senFromMoneyString,
} from '@/utils/money';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';
import { categoryColor } from './categoryMeta';
import { CategoryAddSheet } from './CategoryAddSheet';
import { CalendarSheet } from './CalendarSheet';
import { ConfirmSheet } from './ConfirmSheet';
import { Chip } from '@/components/ui/Chip';
import { FormGroup } from '@/components/ui/FormGroup';
import { OptionTile } from '@/components/ui/OptionTile';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Stepper } from '@/components/ui/Stepper';
import { Switch } from '@/components/ui/Switch';
import { useKeyboardAwareFocus } from '@/components/KeyboardAwareScrollView';
import { haptics } from '@/utils/haptics';
import type { ExpenseInput } from '@/repositories/types';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function yesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateString(d);
}

function formatDisplayDate(dateStr: string): string {
  if (!DATE_RE.test(dateStr)) return dateStr;
  const today = todayLocal();
  const yesterday = yesterdayLocal();
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekday = WEEKDAYS[dateObj.getDay()] ?? '';
  const monthName = SHORT_MONTHS[m - 1] ?? '';

  if (dateStr === today) {
    return `Today, ${d} ${monthName}`;
  }
  if (dateStr === yesterday) {
    return `Yesterday, ${d} ${monthName}`;
  }
  return `${weekday}, ${d} ${monthName}`;
}

function formatAccountKind(type: string): string {
  switch (type) {
    case 'bank':
      return 'Bank';
    case 'cash':
      return 'Wallet';
    case 'credit_card':
      return 'Credit';
    case 'paylater':
      return 'Pay later';
    case 'ewallet':
      return 'eWallet';
    default:
      return type;
  }
}

/** Matches parseMoneyToSen's MONEY_RE: whole ringgit, <=2 decimal sen. */
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

export function expenseToFormValues(expense: Expense): {
  values: ExpenseFormValues & { installment?: { months: number; monthlyRateBp: number } };
  readOnly: boolean;
} {
  return {
    values: {
      amount: formatSenInput(expense.amountSen),
      categoryId: expense.categoryId,
      accountId: expense.accountId ?? 0,
      date: expense.date,
      description: expense.description ?? '',
    },
    readOnly: expense.commitmentPaymentId !== null,
  };
}

export interface ExpenseFormProps {
  categories: Category[];
  accounts: Account[];
  defaults?: Partial<ExpenseFormValues> & {
    installment?: { months: number; monthlyRateBp: number };
  };
  submitLabel?: string;
  onSubmit(input: ExpenseInput): Promise<void>;
  submitting: boolean;
  onCancel(): void;
  onCreateCategory(name: string, icon: string): Promise<Category>;
  onDeleteCategory(id: number): Promise<void>;
}

export function ExpenseForm({
  categories,
  accounts,
  defaults,
  submitLabel = 'Save expense',
  onSubmit,
  submitting,
  onCreateCategory,
  onDeleteCategory,
}: ExpenseFormProps) {
  const { colors } = useTheme();
  const onKeyboardFocus = useKeyboardAwareFocus();

  const initialCategoryId =
    defaults?.categoryId ?? (categories.length > 0 ? categories[0]?.id : undefined);
  const initialAccountId =
    defaults?.accountId ?? (accounts.length > 0 ? accounts[0]?.id : undefined);

  const {
    control,
    handleSubmit,
    setValue,
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: defaults?.amount ?? '0.00',
      description: defaults?.description ?? '',
      date: defaults?.date ?? todayLocal(),
      categoryId: initialCategoryId,
      accountId: initialAccountId,
    },
  });

  const watched = useWatch<ExpenseFormValues>({ control });
  const selectedAccount = accounts.find((a) => a.id === watched.accountId);
  const isCredit =
    selectedAccount?.type === 'credit_card' || selectedAccount?.type === 'paylater';

  // Credit installment split state
  const [splitEnabled, setSplitEnabled] = useState<boolean>(
    defaults?.installment != null,
  );
  const [splitMonths, setSplitMonths] = useState<number>(
    defaults?.installment?.months ?? 3,
  );
  const [ratePercent, setRatePercent] = useState<number>(
    defaults?.installment?.monthlyRateBp ? defaults.installment.monthlyRateBp / 100 : 0,
  );

  // Category management state
  const [armedDelete, setArmedDelete] = useState<Category | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  // Amount input state & caret animation
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [caretOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!focused || process.env.NODE_ENV === 'test') return;
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, { toValue: 0, duration: 0, delay: 500, useNativeDriver: true }),
        Animated.timing(caretOpacity, { toValue: 1, duration: 0, delay: 500, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => {
      blink.stop();
      caretOpacity.setValue(1);
    };
  }, [caretOpacity, focused]);

  const rawAmountStr = watched.amount ?? '0.00';
  const sen = senFromMoneyString(rawAmountStr);
  const absSen = Math.abs(sen);
  const ringgitStr = Math.floor(absSen / 100).toLocaleString('en-US');
  const centsStr = String(absSen % 100).padStart(2, '0');
  const amountDisplay = `${ringgitStr}.${centsStr}`;

  // Installment calculations
  let splitResult = {
    parts: [] as InstallmentPart[],
    totalPayableSen: 0,
    totalInterestSen: 0,
    monthlyPaymentSen: 0,
    lastPaymentSen: 0,
  };
  let principalSen = 0;
  try {
    principalSen = parseMoneyToSen(rawAmountStr);
  } catch {
    principalSen = 0;
  }
  if (principalSen > 0 && splitMonths > 0) {
    try {
      splitResult = splitInstallment(
        principalSen,
        splitMonths,
        Math.round(ratePercent * 100),
      );
    } catch {
      // Keep defaults
    }
  }
  const hasRemainder =
    splitResult.parts.length > 0 &&
    splitResult.lastPaymentSen !== splitResult.monthlyPaymentSen;

  let landingFootnote = 'Lands in next bills · last part absorbs rounding';
  try {
    const statementDay = selectedAccount?.statementDay ?? 20;
    const startCycle = billCycleForDate(watched.date || todayLocal(), statementDay);
    const endCycle = monthShift(startCycle.year, startCycle.month, splitMonths - 1);
    const startName = SHORT_MONTHS[startCycle.month - 1];
    const endName = SHORT_MONTHS[endCycle.month - 1];
    landingFootnote = `Lands in the ${startName} – ${endName} bills · last part absorbs rounding`;
  } catch {
    landingFootnote = 'Lands in next bills · last part absorbs rounding';
  }

  const visibleCategories = categories.filter((c) => c.name.toLowerCase() !== 'other');

  const onValid = (values: ExpenseFormValues) => {
    const amountSen = parseMoneyToSen(values.amount);
    const monthlyRateBp = Math.round(ratePercent * 100);
    const installment =
      isCredit && splitEnabled
        ? { months: splitMonths, monthlyRateBp }
        : undefined;

    void onSubmit({
      amountSen,
      categoryId: values.categoryId,
      accountId: values.accountId,
      date: values.date,
      description: values.description,
      installment,
    });
  };

  return (
    <View style={styles.container} testID="expense-form">
      {/* 1. AMOUNT SECTION */}
      <Controller
        control={control}
        name="amount"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <View style={styles.amountSection} testID="money-input">
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
              Amount
            </Text>
            <Pressable
              onPress={() => inputRef.current?.focus()}
              style={styles.amountHeroRow}
              accessibilityRole="button"
              accessibilityLabel={`Amount in ringgit, RM${amountDisplay}`}
            >
              <Text
                style={[
                  styles.amountPrefix,
                  {
                    color: colors.textTertiary,
                  },
                ]}
              >
                RM
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[
                  styles.amountHeroText,
                  {
                    color: colors.text,
                  },
                ]}
                testID="amount-display"
              >
                {amountDisplay}
              </Text>
              {focused ? (
                <Animated.View
                  style={[
                    styles.caret,
                    {
                      backgroundColor: colors.accent,
                      opacity: caretOpacity,
                    },
                  ]}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  testID="amount-caret"
                />
              ) : null}
            </Pressable>

            {/* Hidden TextInput for POS typing */}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              keyboardType="number-pad"
              inputMode="numeric"
              value={String(sen)}
              caretHidden
              autoFocus
              editable={!submitting}
              selection={{ start: String(sen).length, end: String(sen).length }}
              onChangeText={(text) => {
                haptics.keypadPress();
                onChange(formatSenInput(senFromInputText(sen, text)));
              }}
              onFocus={() => {
                setFocused(true);
                onKeyboardFocus();
              }}
              onBlur={() => setFocused(false)}
              accessibilityLabel="Amount in ringgit"
              testID="expense-form-amount"
            />

            {error ? (
              <Text style={[styles.fieldError, { color: colors.danger }]}>
                {error.message}
              </Text>
            ) : null}
          </View>
        )}
      />

      {/* 2. CATEGORY SECTION */}
      <Controller
        control={control}
        name="categoryId"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Category
            </Text>
            <View style={styles.categoryWrap} testID="category-matrix">
              {visibleCategories.map((category) => {
                const isSelected = value === category.id;
                const armed = armedDelete?.id === category.id;
                return (
                  <View key={category.id} style={styles.chipWrapper}>
                    <Chip
                      label={category.name}
                      icon={category.icon as never}
                      iconColor={categoryColor(category.id)}
                      selected={isSelected}
                      onPress={() => {
                        if (armed) {
                          setArmedDelete(null);
                          return;
                        }
                        haptics.categorySelect();
                        onChange(category.id);
                      }}
                      onLongPress={() => setArmedDelete(armed ? null : category)}
                      delayLongPress={450}
                      testID={`expense-form-category-${category.id}`}
                    />
                    {armed ? (
                      <Pressable
                        onPress={() => setConfirmDelete(category)}
                        style={[
                          styles.deleteBadge,
                          {
                            backgroundColor: colors.danger,
                          },
                        ]}
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

              {/* Add category (+) chip */}
              <Chip
                label="+"
                selected={false}
                onPress={() => setAddOpen(true)}
                testID="expense-form-category-add"
              />
            </View>
            {error ? (
              <Text style={[styles.fieldError, { color: colors.danger }]}>
                {error.message}
              </Text>
            ) : null}
          </View>
        )}
      />

      {/* 3. PAID WITH (ACCOUNTS) SECTION */}
      <Controller
        control={control}
        name="accountId"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Paid with
            </Text>
            <View style={styles.accountsGrid}>
              {accounts.map((acc) => {
                const isSelected = value === acc.id;
                return (
                  <View key={acc.id} style={styles.accountCell}>
                    <OptionTile
                      name={acc.name}
                      kind={formatAccountKind(acc.type)}
                      accountType={acc.type as never}
                      selected={isSelected}
                      onPress={() => {
                        haptics.categorySelect();
                        onChange(acc.id);
                      }}
                      testID={`account-pill-${acc.id}`}
                    />
                  </View>
                );
              })}
            </View>
            {error ? (
              <Text style={[styles.fieldError, { color: colors.danger }]}>
                {error.message}
              </Text>
            ) : null}
          </View>
        )}
      />

      {/* 4. CREDIT SPLIT BLOCK (Only when account is credit_card or paylater) */}
      {isCredit ? (
        <View style={styles.section}>
          <FormGroup style={styles.splitGroup}>
            {/* Top row with Switch */}
            <View style={styles.splitHeaderRow}>
              <View style={styles.splitHeaderText}>
                <Text
                  style={[
                    styles.splitTitle,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  Split into months
                </Text>
                <Text
                  style={[
                    styles.splitSubtitle,
                    {
                      color: colors.textTertiary,
                    },
                  ]}
                >
                  Each part lands in a later bill
                </Text>
              </View>
              <Switch
                value={splitEnabled}
                onValueChange={(val) => {
                  haptics.categorySelect();
                  setSplitEnabled(val);
                }}
                accessibilityLabel="Split into months"
                testID="split-switch"
              />
            </View>

            {splitEnabled ? (
              <View style={styles.splitBody}>
                {/* Month options: 3 / 6 / 12 mo */}
                <View style={styles.monthOptionsRow}>
                  {[3, 6, 12].map((m) => {
                    const isSelected = splitMonths === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => {
                          haptics.categorySelect();
                          setSplitMonths(m);
                        }}
                        style={[
                          styles.monthOptionBtn,
                          {
                            backgroundColor: isSelected ? colors.accent : colors.fillStrong,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        testID={`split-months-${m}`}
                      >
                        <Text
                          style={[
                            styles.monthOptionText,
                            {
                              color: isSelected ? colors.onAccent : colors.text,
                            },
                          ]}
                        >
                          {m} mo
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Interest per month Stepper */}
                <View style={styles.stepperRow}>
                  <View style={styles.stepperText}>
                    <Text
                      style={[
                        styles.stepperTitle,
                        {
                          color: colors.text,
                        },
                      ]}
                    >
                      Interest per month
                    </Text>
                    <Text
                      style={[
                        styles.stepperSubtitle,
                        {
                          color: colors.textTertiary,
                        },
                      ]}
                    >
                      On the price, added to each part
                    </Text>
                  </View>
                  <Stepper
                    value={ratePercent}
                    onChange={(val) => {
                      haptics.categorySelect();
                      setRatePercent(val);
                    }}
                    min={0}
                    max={5.0}
                    step={0.5}
                    testID="interest-stepper"
                  />
                </View>

                {/* Summary Card */}
                <View
                  style={[
                    styles.summaryCard,
                    {
                      borderTopColor: colors.separatorStrong,
                    },
                  ]}
                >
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                      Per month
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.summaryPerMonthValue,
                        {
                          color: colors.emphasis,
                        },
                      ]}
                    >
                      {formatSen(splitResult.monthlyPaymentSen)}
                      {hasRemainder ? ` (last ${formatSen(splitResult.lastPaymentSen)})` : ''}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                      Total payable
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.summaryTotalValue,
                        {
                          color: colors.text,
                        },
                      ]}
                    >
                      {formatSen(splitResult.totalPayableSen)}
                    </Text>
                  </View>

                  <Text style={[styles.summaryFootnote, { color: colors.textTertiary }]}>
                    {landingFootnote}
                  </Text>
                </View>
              </View>
            ) : null}
          </FormGroup>
        </View>
      ) : null}

      {/* 5. DATE & NOTE FORM GROUP */}
      <View style={styles.section}>
        <FormGroup style={styles.factsGroup}>
          {/* Date Row */}
          <Controller
            control={control}
            name="date"
            render={({ field: { value, onChange } }) => (
              <Pressable
                onPress={() => setDateOpen(true)}
                disabled={submitting}
                style={[
                  styles.formRow,
                  {
                    borderBottomColor: colors.separator,
                    borderBottomWidth: 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Date, ${formatDisplayDate(value)}, picked`}
                testID="expense-form-date"
              >
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                  Date
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.rowValue,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  {formatDisplayDate(value)}
                </Text>
              </Pressable>
            )}
          />

          {/* Note Row */}
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange } }) => (
              <View style={styles.formRow}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                  Note
                </Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder="Optional"
                  placeholderTextColor={colors.textTertiary}
                  editable={!submitting}
                  onFocus={onKeyboardFocus}
                  style={[
                    styles.noteInput,
                    {
                      color: colors.text,
                    },
                  ]}
                  accessibilityLabel="Expense note"
                  testID="expense-form-description"
                />
              </View>
            )}
          />
        </FormGroup>
      </View>

      {/* 6. PRIMARY SAVE BUTTON */}
      <View style={styles.submitSection}>
        <PrimaryButton
          label={submitLabel}
          onPress={handleSubmit(onValid)}
          loading={submitting}
          disabled={submitting}
          testID="expense-form-submit"
        />
      </View>

      {/* Calendar picker sheet */}
      <CalendarSheet
        visible={dateOpen}
        title="Select date"
        value={watched.date}
        onSelect={(iso) => {
          setValue('date', iso, { shouldValidate: true });
          setDateOpen(false);
        }}
        onCancel={() => setDateOpen(false)}
      />

      {/* Category add sheet */}
      <CategoryAddSheet
        visible={addOpen}
        onSave={async (name, icon) => {
          const created = await onCreateCategory(name, icon);
          setValue('categoryId', created.id, { shouldValidate: true });
          setAddOpen(false);
        }}
        onCancel={() => setAddOpen(false)}
      />

      {/* Category delete confirm sheet */}
      <ConfirmSheet
        visible={confirmDelete !== null}
        title="Delete category"
        message={
          confirmDelete ? `Delete "${confirmDelete.name}"? Existing expenses will not be deleted.` : ''
        }
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={async () => {
          if (!confirmDelete) return;
          setDeleting(true);
          try {
            await onDeleteCategory(confirmDelete.id);
            if (watched.categoryId === confirmDelete.id) {
              const remaining = categories.filter((c) => c.id !== confirmDelete.id);
              if (remaining[0]) setValue('categoryId', remaining[0].id);
            }
            setConfirmDelete(null);
            setArmedDelete(null);
          } finally {
            setDeleting(false);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  amountLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  amountHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  amountPrefix: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
  },
  amountHeroText: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    letterSpacing: -0.88,
    fontVariant: tabularNumsVariant,
  },
  caret: {
    width: 2,
    height: 38,
    marginLeft: 2,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  fieldError: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipWrapper: {
    position: 'relative',
  },
  deleteBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  accountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountCell: {
    width: '48%',
    flexGrow: 1,
  },
  splitGroup: {
    padding: 14,
    gap: 12,
    borderRadius: 14,
  },
  splitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  splitHeaderText: {
    flex: 1,
    gap: 2,
  },
  splitTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  splitSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  splitBody: {
    gap: 12,
  },
  monthOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  monthOptionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthOptionText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  stepperText: {
    flex: 1,
    gap: 2,
  },
  stepperTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  stepperSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  summaryCard: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  summaryPerMonthValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
  },
  summaryTotalValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
  },
  summaryFootnote: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  factsGroup: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  formRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  rowValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  noteInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: geistWeights.regular,
    padding: 0,
    marginLeft: 12,
  },
  submitSection: {
    marginTop: 8,
    paddingBottom: 16,
  },
});