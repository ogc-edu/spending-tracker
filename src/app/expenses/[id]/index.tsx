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
import { splitInstallment } from '@/engine/creditBills';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useToast } from '@/components/ToastProvider';
import { formatDayLabel } from '@/utils/dates';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { CategoryTile } from '@/components/ui/CategoryTile';
import { FormGroup, FormRow } from '@/components/ui/FormGroup';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

export default function ExpenseDetailScreen() {
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
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const doDelete = async () => {
    if (!expense) return;
    setDeleting(true);
    try {
      await services.expenses.delete(expenseId);
      setConfirmDeleteVisible(false);
      router.back();
    } catch (error: unknown) {
      toast.show(`Could not delete expense: ${errMsg(error)}`);
      setConfirmDeleteVisible(false);
    } finally {
      setDeleting(false);
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

  const category = categories.find((c) => c.id === expense.categoryId);
  const account = accounts.find((a) => a.id === expense.accountId);
  const linked = expense.commitmentPaymentId !== null;

  let splitData = null;
  if (installment) {
    splitData = splitInstallment(
      installment.principalSen,
      installment.months,
      installment.monthlyRateBp,
    );
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.bg,
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
      testID="expense-detail-screen"
    >
      {/* Top Navigation Bar: Back link left, Edit link right */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.navLink}
        >
          <Text style={[styles.navLinkText, { color: colors.link }]}>Back</Text>
        </Pressable>

        {!linked ? (
          <Pressable
            onPress={() => router.push(`/expenses/${expense.id}/edit` as never)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit"
            style={styles.navLink}
            testID="expense-detail-edit"
          >
            <Text style={[styles.navLinkText, { color: colors.link }]}>Edit</Text>
          </Pressable>
        ) : (
          <View style={styles.topBarRightSpacer} />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(32, insets.bottom + 20) },
        ]}
      >
        {/* Linked Badge if applicable */}
        {linked ? (
          <View
            style={[
              styles.linkedBadge,
              {
                backgroundColor: colors.fill,
                borderColor: colors.separator,
              },
            ]}
          >
            <Ionicons name="link-outline" size={16} color={colors.accent} />
            <Text style={[styles.linkedBadgeLabel, { color: colors.text }]}>
              Auto-created from commitment
            </Text>
          </View>
        ) : null}

        {/* Hero Amount & Category Header Block */}
        <View style={styles.heroBlock}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[
              styles.amountSheetText,
              {
                color: colors.text,
              },
            ]}
            accessibilityLabel={`Expense amount, ${spokenMoneyLabel(expense.amountSen)}`}
            testID="expense-detail-amount"
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

        {/* Facts FormGroup */}
        <FormGroup style={styles.factsGroup}>
          <FormRow
            label="Date"
            value={`${formatDayLabel(expense.date)} · ${expense.date}`}
          />
          <FormRow
            label="Account"
            value={account ? `${account.name} (${formatAccountKind(account.type)})` : 'None'}
          />
          <FormRow
            label="Category"
            value={category?.name ?? 'Uncategorized'}
          />
          {expense.description ? (
            <FormRow
              label="Note"
              value={expense.description}
              isLast={!installment}
            />
          ) : null}

          {installment && splitData ? (
            <>
              <FormRow
                label="Installment plan"
                value={`${installment.months} months`}
              />
              <FormRow
                label="Per month"
                value={formatSen(splitData.monthlyPaymentSen)}
              />
              <FormRow
                label="Interest rate"
                value={`${(installment.monthlyRateBp / 100).toFixed(2)}% per month`}
              />
              <FormRow
                label="Total payable"
                value={formatSen(splitData.totalPayableSen)}
                isLast
              />
            </>
          ) : null}
        </FormGroup>

        {linked ? (
          <Text style={[styles.linkedHint, { color: colors.textTertiary }]}>
            This expense was created when you marked a commitment payment as paid. To change or remove it, un-pay the payment in Due.
          </Text>
        ) : null}

        {/* Destructive Delete Button */}
        {!linked ? (
          <Pressable
            onPress={() => setConfirmDeleteVisible(true)}
            style={[
              styles.deleteButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.separator,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete expense"
            testID="expense-detail-delete"
          >
            <Text style={[styles.deleteButtonText, { color: colors.danger }]}>
              Delete expense
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* ConfirmSheet for Delete */}
      <ConfirmSheet
        visible={confirmDeleteVisible}
        title="Delete expense"
        message="This reverses the balance change on its account."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
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
  navLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  navLinkText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  topBarRightSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 20,
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
  deleteButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
});