/**
 * Settings screen (plans 003 + 004 + 013). 003: signed-in user + logout.
 * 004: the ACCOUNTS section (list with credit-card "Owed", add-at-form via
 * AccountForm, FK-protected delete) plus a read-only CATEGORIES preview that
 * proves the seeded-repository path (the real consumer is the 005 expense form).
 * 013: the AI Providers section — Gemini/DeepSeek BYOK rows (Not configured /
 * masked key suffix) and the Active AI Provider selector (configured only;
 * no automatic fallback).
 *
 * Balances are NOT editable here (D1 — they change only through expenses).
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category } from '@/db/schema';
import { AccountService } from '@/services/AccountService';
import { CategoryService } from '@/services/CategoryService';
import { AiConfigService, type ConfigurableAIProvider } from '@/services/AiConfigService';
import type { AccountInput } from '@/repositories/types';
import type { AIProviderName } from '@/ai/types';
import { AccountForm } from '@/components/AccountForm';
import { AccountRow } from '@/components/AccountRow';
import { ProviderRow, maskKeySuffix } from '@/components/ai/ProviderRow';
import { ActiveProviderSelector } from '@/components/ai/ActiveProviderSelector';
import { colors, spacing, typography } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, authService } = useAuth();

  // Services built once auth is available; repositories() needs the initialized DB.
  const services = useMemo(() => {
    const repos = repositories();
    return {
      accounts: new AccountService(repos.accounts, authService),
      categories: new CategoryService(repos.categories),
      ai: new AiConfigService(repos.settings, authService),
    };
  }, [authService]);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Plan 013: masked key suffix per provider (null = not configured) + active choice.
  const [aiSuffixes, setAiSuffixes] = useState<Partial<Record<ConfigurableAIProvider, string | null>>>({});
  const [aiActive, setAiActive] = useState<AIProviderName | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await services.accounts.list());
      setAccountsError(null);
    } catch (error: unknown) {
      setAccountsError(errMsg(error));
    }
  }, [services.accounts]);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await services.categories.list());
    } catch {
      // Read-only preview; non-fatal.
    }
  }, [services.categories]);

  const loadAi = useCallback(async () => {
    try {
      const [geminiKey, deepseekKey, active] = await Promise.all([
        services.ai.getKey('gemini'),
        services.ai.getKey('deepseek'),
        services.ai.getActiveProvider(),
      ]);
      setAiSuffixes({
        gemini: geminiKey ? maskKeySuffix(geminiKey) : null,
        deepseek: deepseekKey ? maskKeySuffix(deepseekKey) : null,
      });
      setAiActive(active);
    } catch {
      // Keep the previous state; non-fatal.
    }
  }, [services.ai]);

  /** The active selector lists CONFIGURED providers only (no automatic fallback). */
  const configuredProviders: ConfigurableAIProvider[] = (['gemini', 'deepseek'] as const).filter(
    (p) => aiSuffixes[p] !== null,
  );

  const handleSelectActive = async (provider: ConfigurableAIProvider) => {
    try {
      await services.ai.setActiveProvider(provider);
      setAiActive(provider);
    } catch (error: unknown) {
      Alert.alert('Active AI provider', errMsg(error));
    }
  };

  // Re-read on focus (ARCHITECTURE §5 — SQLite is the source of truth, no cache).
  useFocusEffect(
    useCallback(() => {
      void loadAccounts();
    }, [loadAccounts]),
  );

  useFocusEffect(
    useCallback(() => {
      void loadCategories();
    }, [loadCategories]),
  );

  useFocusEffect(
    useCallback(() => {
      void loadAi();
    }, [loadAi]),
  );

  const handleAdd = async (input: AccountInput) => {
    setSubmitting(true);
    try {
      await services.accounts.create(input);
      setShowForm(false);
      await loadAccounts();
    } catch (error: unknown) {
      Alert.alert('Add account', errMsg(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (account: Account) => {
    Alert.alert(
      'Delete account',
      `Delete "${account.name}"? Its balance is removed from your available money.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await services.accounts.delete(account.id);
              await loadAccounts();
            } catch (error: unknown) {
              Alert.alert('Cannot delete', errMsg(error));
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="settings-screen">
      <Text style={styles.title}>Settings</Text>

      {/* Account 003: signed-in user + logout. */}
      {user ? (
        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.email} testID="settings-email">
            {user.email}
          </Text>
        </View>
      ) : null}

      {/* Plan 004: Accounts section. */}
      <Text style={styles.sectionTitle}>Accounts</Text>

      {accountsError ? (
        <Text style={styles.errorText} testID="accounts-error">
          {accountsError}
        </Text>
      ) : null}

      {accounts.length === 0 && !accountsError ? (
        <Text style={styles.empty}>No accounts yet — add one to start tracking money.</Text>
      ) : (
        accounts.map((account) => (
          <AccountRow key={account.id} account={account} onDelete={() => handleDelete(account)} />
        ))
      )}

      {showForm ? (
        <AccountForm onSubmit={handleAdd} submitting={submitting} onCancel={() => setShowForm(false)} />
      ) : (
        <Pressable
          onPress={() => setShowForm(true)}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="add-account-button"
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
          <Text style={styles.addButtonLabel}>Add account</Text>
        </Pressable>
      )}

      {accounts.some((a) => a.type === 'credit_card') ? (
        <Text style={styles.note}>Credit-card accounts show the amount owed and count negatively.</Text>
      ) : null}

      {/* Plan 004: read-only categories preview (proves the seeded repository). */}
      <Text style={styles.sectionTitle}>Categories</Text>
      <Text style={styles.note}>Default categories power the expense form.</Text>
      <View style={styles.chipWrap}>
        {categories.map((category) => (
          <View key={category.id} style={styles.chip}>
            <Ionicons name={category.icon as never} size={14} color={colors.accent} />
            <Text style={styles.chipLabel}>{category.name}</Text>
          </View>
        ))}
      </View>

      {/* Plan 013: AI Providers (BYOK — Gemini + DeepSeek). */}
      <Text style={styles.sectionTitle}>AI Provider</Text>
      <Text style={styles.note}>
        Bring your own API key to analyze your finances with AI. Keys are stored securely on this
        device and sent only to the provider.
      </Text>
      <ProviderRow
        provider="gemini"
        configured={aiSuffixes.gemini !== null}
        suffix={aiSuffixes.gemini ?? null}
        onPress={() => router.push('/settings/ai/gemini' as never)}
      />
      <ProviderRow
        provider="deepseek"
        configured={aiSuffixes.deepseek !== null}
        suffix={aiSuffixes.deepseek ?? null}
        onPress={() => router.push('/settings/ai/deepseek' as never)}
      />
      <Text style={styles.activeLabel}>Active AI provider</Text>
      <ActiveProviderSelector
        configured={configuredProviders}
        active={aiActive}
        onSelect={handleSelectActive}
      />
      <Text style={styles.note}>
        Analysis actions use the active provider only — there is no automatic fallback.
      </Text>

      <Pressable
        onPress={logout}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
        testID="settings-logout"
      >
        <Text style={styles.buttonLabel}>Log out</Text>
      </Pressable>

      <Text style={styles.footNote}>AI analysis through your own provider keys.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  title: { fontSize: typography.title, fontWeight: '700', color: colors.text, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  label: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.xs },
  email: { fontSize: typography.body, fontWeight: '600', color: colors.text },
  sectionTitle: {
    fontSize: typography.emphasis,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  empty: { fontSize: typography.body, color: colors.muted, marginBottom: spacing.md },
  errorText: { fontSize: typography.body, color: colors.danger, marginBottom: spacing.md },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  addButtonLabel: { color: colors.accent, fontSize: typography.emphasis, fontWeight: '600' },
  note: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.lg },
  activeLabel: {
    fontSize: typography.caption,
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipLabel: { fontSize: typography.caption, color: colors.text, fontWeight: '600' },
  button: {
    backgroundColor: colors.danger,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonLabel: { color: '#fff', fontSize: typography.emphasis, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  footNote: { marginTop: spacing.lg, fontSize: typography.body, color: colors.muted },
});