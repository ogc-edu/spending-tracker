import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category } from '@/db/schema';
import { AccountService } from '@/services/AccountService';
import { CategoryService } from '@/services/CategoryService';
import { ExpenseService } from '@/services/ExpenseService';
import { ExpenseForm } from '@/components/ExpenseForm';
import { useToast } from '@/components/ToastProvider';
import { useUiStore } from '@/store/uiStore';
import { todayLocal } from '@/utils/dates';
import type { ExpenseInput } from '@/repositories/types';
import { geistWeights, useTheme } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function NewExpenseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authService } = useAuth();
  const toast = useToast();
  const { colors } = useTheme();
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
      // Fast entry: remember last-used picks
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
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (accounts.length === 0) {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: colors.bg,
            paddingTop: insets.top,
          },
        ]}
      >
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No accounts yet</Text>
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
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
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.bg,
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
      testID="new-expense-screen"
    >
      {/* Top Modal Navigation Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={styles.cancelLink}
        >
          <Text
            style={[
              styles.cancelText,
              {
                color: colors.link,
              },
            ]}
          >
            Cancel
          </Text>
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
          New expense
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
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: geistWeights.regular,
    textAlign: 'center',
  },
});