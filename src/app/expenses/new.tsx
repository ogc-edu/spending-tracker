/**
 * New expense screen (plan 005 / EXP-1, EXP-8 fast entry) — push screen at
 * /expenses/new. Prefills: date = today, category/account = last-used (or the
 * first seeded category / first account when the user hasn't recorded one
 * yet). Amount input auto-focuses → record in ≤3 taps. On success the
 * last-used picks are stored for the NEXT fast entry.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category } from '@/db/schema';
import { AccountService } from '@/services/AccountService';
import { CategoryService } from '@/services/CategoryService';
import { ExpenseService } from '@/services/ExpenseService';
import { ExpenseForm } from '@/components/ExpenseForm';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { useToast } from '@/components/ToastProvider';
import { useUiStore } from '@/store/uiStore';
import { todayLocal } from '@/utils/dates';
import type { ExpenseInput } from '@/repositories/types';
import { colors, spacing, typography } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function NewExpenseScreen() {
  const router = useRouter();
  const { authService } = useAuth();
  const toast = useToast();
  const { lastUsedCategoryId, lastUsedAccountId } = useUiStore();

  const services = useMemo(() => {
    const repos = repositories();
    return {
      expenses: new ExpenseService(repos.expenses, repos.categories, authService),
      accounts: new AccountService(repos.accounts, authService),
      categories: new CategoryService(repos.categories),
    };
  }, [authService]);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [accs, cats] = await Promise.all([
        services.accounts.list(),
        services.categories.list(),
      ]);
      setAccounts(accs);
      setCategories(cats);
    } catch (error: unknown) {
      Alert.alert('Expenses', errMsg(error));
    } finally {
      setLoading(false);
    }
  }, [services.accounts, services.categories]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleSubmit = async (input: ExpenseInput) => {
    setSubmitting(true);
    try {
      await services.expenses.create(input);
      // Fast entry (EXP-8): remember the picks for next time.
      useUiStore.getState().setLastUsed(input.categoryId, input.accountId);
      toast.show('Expense saved');
      router.back();
    } catch (error: unknown) {
      toast.show(`Could not add expense: ${errMsg(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (accounts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No accounts yet</Text>
        <Text style={styles.emptyBody}>
          Add an account in Settings → Accounts before recording expenses — every expense adjusts its account balance.
        </Text>
      </View>
    );
  }

  const defaults = {
    date: todayLocal(),
    categoryId: lastUsedCategoryId ?? categories[0]?.id,
    accountId: lastUsedAccountId ?? accounts[0]?.id,
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="new-expense-screen"
    >
      <ExpenseForm
        categories={categories}
        accounts={accounts}
        defaults={defaults}
        submitLabel="Add expense"
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
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.cancelLink, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.cancelLinkLabel}>Cancel</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyBody: { fontSize: typography.body, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  cancelLink: { alignItems: 'center', paddingVertical: spacing.lg },
  cancelLinkLabel: { color: colors.muted, fontSize: typography.body, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});