import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category, Expense, ExpenseInstallment } from '@/db/schema';
import { AccountService } from '@/services/AccountService';
import { CategoryService } from '@/services/CategoryService';
import { ExpenseService } from '@/services/ExpenseService';
import { ExpenseForm } from '@/components/ExpenseForm';
import { useToast } from '@/components/ToastProvider';
import { formatDayLabel } from '@/utils/dates';
import { formatSen, formatSenInput, spokenMoneyLabel } from '@/utils/money';
import { CategoryTile } from '@/components/ui/CategoryTile';
import { FormGroup, FormRow } from '@/components/ui/FormGroup';
import type { ExpenseInput } from '@/repositories/types';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function EditExpenseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authService } = useAuth();
  const toast = useToast();
  const { colors } = useTheme();
  const expenseId = Number(id);

  const services = useMemo(() => {
    const repos = repositories();
    return {
      expenses: new ExpenseService(repos.expenses, repos.categories, authService),
      accounts: new AccountService(repos.accounts, authService),
      categories: new CategoryService(repos.categories),
    };
  }, [authService]);

  const [expense, setExpense] = useState<Expense | null>(null);
  const [installment, setInstallment] = useState<ExpenseInstallment | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(expenseId) || expenseId <= 0) {
      setLoadError('Invalid expense');
      setLoading(false);
      return;
    }
    try {
      const [row, inst, accs, cats] = await Promise.all([
        services.expenses.byId(expenseId),
        services.expenses.getInstallment(expenseId).catch(() => null),
        services.accounts.list(),
        services.categories.list(),
      ]);
      setExpense(row);
      setInstallment(inst);
      setAccounts(accs);
      setCategories(cats);
      setLoadError(null);
    } catch (error: unknown) {
      setLoadError(errMsg(error));
    } finally {
      setLoading(false);
    }
  }, [expenseId, services]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleSubmit = async (input: ExpenseInput) => {
    setSubmitting(true);
    try {
      await services.expenses.edit(expenseId, input);
      toast.show('Expense saved');
      router.back();
    } catch (error: unknown) {
      toast.show(`Could not save expense: ${errMsg(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (loadError || !expense) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{loadError ?? 'Expense not found'}</Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { borderColor: colors.separator, backgroundColor: colors.surface }]}
          accessibilityRole="button"
        >
          <Text style={[styles.backBtnLabel, { color: colors.text }]}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const linked = expense.commitmentPaymentId !== null;
  const category = categories.find((c) => c.id === expense.categoryId);
  const account = accounts.find((a) => a.id === expense.accountId);

  // Linked read-only view
  if (linked) {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: colors.bg,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
        testID="linked-expense-view"
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.cancelLink}
            testID="linked-expense-back"
          >
            <Text style={[styles.cancelText, { color: colors.link }]}>Back</Text>
          </Pressable>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Linked expense</Text>
          <View style={styles.topBarRightSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(24, insets.bottom + 16) },
          ]}
        >
          <View
            style={[
              styles.linkedBadge,
              {
                backgroundColor: colors.fill,
                borderColor: colors.separator,
              },
            ]}
            testID="linked-commitment-lock"
          >
            <Ionicons name="lock-closed" size={16} color={colors.accent} />
            <Text style={[styles.linkedBadgeLabel, { color: colors.text }]}>
              Linked to commitment payment
            </Text>
          </View>

          <View style={styles.heroBlock}>
            <Text
              numberOfLines={1}
              style={[
                styles.amountSheetText,
                {
                  color: colors.text,
                },
              ]}
              accessibilityLabel={`Expense amount, ${spokenMoneyLabel(expense.amountSen)}`}
            >
              {formatSen(expense.amountSen)}
            </Text>
            <View style={styles.categoryHeaderRow}>
              <CategoryTile categoryIndex={category?.id} name={category?.name} />
              <Text style={[styles.categoryHeaderText, { color: colors.text }]}>
                {category?.name ?? 'Expense'}
              </Text>
            </View>
          </View>

          <FormGroup style={styles.factsGroup}>
            <FormRow
              label="Date"
              value={`${formatDayLabel(expense.date)} · ${expense.date}`}
            />
            <FormRow
              label="Account"
              value={account ? account.name : 'None'}
            />
            <FormRow
              label="Category"
              value={category?.name ?? 'Uncategorized'}
            />
            {expense.description ? (
              <FormRow label="Note" value={expense.description} isLast />
            ) : null}
          </FormGroup>

          <Text style={[styles.linkedHint, { color: colors.textTertiary }]}>
            This expense was created automatically when you recorded a commitment payment. It cannot be edited directly — manage it in Due instead.
          </Text>
        </ScrollView>
      </View>
    );
  }

  const defaults = {
    amount: formatSenInput(installment ? installment.principalSen : expense.amountSen),
    categoryId: expense.categoryId,
    accountId: expense.accountId ?? undefined,
    date: expense.date,
    description: expense.description ?? '',
    installment: installment
      ? { months: installment.months, monthlyRateBp: installment.monthlyRateBp }
      : undefined,
  };

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.bg,
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
      testID="edit-expense-screen"
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={styles.cancelLink}
        >
          <Text style={[styles.cancelText, { color: colors.link }]}>Cancel</Text>
        </Pressable>

        <Text
          numberOfLines={1}
          style={[
            styles.screenTitle,
            {
              color: colors.text,
            },
          ]}
        >
          Edit expense
        </Text>

        <View style={styles.topBarRightSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ExpenseForm
          categories={categories}
          accounts={accounts}
          defaults={defaults}
          submitLabel="Save expense"
          onSubmit={handleSubmit}
          submitting={submitting}
          onCancel={() => router.back()}
          onCreateCategory={async (name, icon) => {
            const created = await services.categories.create(name, icon);
            setCategories((prev) => [...prev, created]);
            return created;
          }}
          onDeleteCategory={async (id) => {
            await services.categories.delete(id);
            setCategories((prev) => prev.filter((c) => c.id !== id));
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    height: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  screenTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    textAlign: 'center',
  },
  topBarRightSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    marginBottom: 16,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backBtnLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  linkedBadgeLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  heroBlock: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  amountSheetText: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    letterSpacing: -0.68,
    fontVariant: tabularNumsVariant,
    textAlign: 'center',
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryHeaderText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  factsGroup: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  linkedHint: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: geistWeights.regular,
  },
});