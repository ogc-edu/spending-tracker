/**
 * Settings screen (plans 003 + 004 + 013). 003: signed-in user + logout.
 * 004: the ACCOUNTS section (list with credit-card "Owed", add-at-form via
 * AccountForm, FK-protected delete) plus a read-only CATEGORIES preview that
 * proves the seeded-repository path (the real consumer is the 005 expense form).
 * 013: the AI Providers section — Gemini/DeepSeek BYOK rows (Not configured /
 * masked key suffix) and the Active AI Provider selector (configured only;
 * no automatic fallback).
 *
 * Plan 020: the Payroll section is hidden (PayrollService, its table and
 * PayrollAllocationSheet stay so it can return) and the safety-buffer editor
 * is gone along with safe-to-spend.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category } from '@/db/schema';
import { AccountService } from '@/services/AccountService';
import { CategoryService } from '@/services/CategoryService';
import { AiConfigService, type ConfigurableAIProvider } from '@/services/AiConfigService';
import type { AccountInput } from '@/repositories/types';
import type { AIProviderName } from '@/ai/types';
import { AccountForm } from '@/components/AccountForm';
import { AccountBalanceSheet } from '@/components/AccountBalanceSheet';
import { AccountRow } from '@/components/AccountRow';
import { CategoryAddSheet } from '@/components/CategoryAddSheet';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/Card';
import { ProviderRow, maskKeySuffix } from '@/components/ai/ProviderRow';
import { ActiveProviderSelector } from '@/components/ai/ActiveProviderSelector';
import { aiStatusLabel } from '@/components/ai/providerMeta';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { useToast } from '@/components/ToastProvider';
import { colors, spacing, typography } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, authService } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();

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
  /** The account whose balance sheet is open (null = closed). */
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Plan 016 follow-up: category manager — long-press enters multi-select
  // mode (header shows Delete); the "+" chip (Other's slot) opens the add sheet.
  const [selecting, setSelecting] = useState(false);
  const [selectedCats, setSelectedCats] = useState<Set<number>>(new Set());
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [confirmDeleteCats, setConfirmDeleteCats] = useState(false);

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

  // ── Plan 016 follow-up: category manager (multi-select delete + add). ──
  const visibleCategories = categories.filter((c) => c.name.toLowerCase() !== 'other');

  const enterSelect = (category: Category): void => {
    setSelecting(true);
    setSelectedCats(new Set([category.id]));
  };

  const toggleSelect = (category: Category): void => {
    if (!selecting) return;
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(category.id)) next.delete(category.id);
      else next.add(category.id);
      return next;
    });
  };

  const exitSelect = (): void => {
    setSelecting(false);
    setSelectedCats(new Set());
  };

  const doDeleteSelected = async (): Promise<void> => {
    setCategoryBusy(true);
    try {
      for (const id of selectedCats) {
        await services.categories.delete(id);
      }
      setConfirmDeleteCats(false);
      setCategories(await services.categories.list());
      exitSelect();
    } catch (error: unknown) {
      Alert.alert('Could not delete categories', errMsg(error));
      setConfirmDeleteCats(false);
    } finally {
      setCategoryBusy(false);
    }
  };

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
      toast.show(`Could not set active provider: ${errMsg(error)}`);
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
      toast.show(`Could not add account: ${errMsg(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  /** Correct an account's recorded balance (no expense, no history change). */
  const handleAdjustBalance = async (balanceSen: number) => {
    if (!editingAccount) return;
    try {
      await services.accounts.setBalance(editingAccount.id, balanceSen);
      setEditingAccount(null);
      await loadAccounts();
    } catch (error: unknown) {
      toast.show(`Could not update balance: ${errMsg(error)}`);
      throw error; // keeps the sheet open with the message inline
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
              toast.show(`Could not delete account: ${errMsg(error)}`);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.xxl) }]}
      testID="settings-screen"
    >
      <Text style={styles.title}>Settings</Text>

      {/* Account 003: signed-in user + logout. */}
      {user ? (
        <Card className="flex-row items-center gap-3.5 mx-6 mb-6 p-4 border border-border shadow-none">
          <Avatar alt="User profile" className="size-11 bg-primary/10 border border-primary/20 items-center justify-center">
            <AvatarFallback className="bg-primary/10">
              <Text className="text-primary font-bold text-base">
                {user.email.slice(0, 1).toUpperCase()}
              </Text>
            </AvatarFallback>
          </Avatar>
          <View className="flex-1">
            <Text style={styles.label}>Signed in as</Text>
            <Text style={styles.email} testID="settings-email">
              {user.email}
            </Text>
          </View>
        </Card>
      ) : null}

      {/* Plan 008: Connected Accounts Stack */}
      <View testID="accounts-stack" className="mb-2">
        <SectionHeader title="Connected Accounts" />

        {accountsError ? (
          <Text style={styles.errorText} testID="accounts-error">
            {accountsError}
          </Text>
        ) : null}

        {accounts.length === 0 && !accountsError ? (
          <Text style={styles.empty} className="px-4">No accounts yet — add one to start tracking money.</Text>
        ) : (
          <View testID="settings-accounts-list" className="px-4 mb-2">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onPress={() => setEditingAccount(account)}
                onDelete={() => handleDelete(account)}
              />
            ))}
          </View>
        )}

        {showForm ? (
          <View className="px-4">
            <AccountForm onSubmit={handleAdd} submitting={submitting} onCancel={() => setShowForm(false)} />
          </View>
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
          <Text style={styles.note} className="px-4">Credit-card accounts show the amount owed and count negatively.</Text>
        ) : null}
      </View>

      <AccountBalanceSheet
        // Remount per account so the sheet prefills with that row's figure.
        key={editingAccount ? `balance-${editingAccount.id}` : 'balance-closed'}
        account={editingAccount}
        onSave={handleAdjustBalance}
        onCancel={() => setEditingAccount(null)}
      />

      {/* Plan 016 follow-up: Categories manager — long-press a chip to select
        (multi-select), Delete appears on the header row; the "+" chip
        (Other's slot) opens the add sheet. Delete is list-only: existing
        expenses keep their category label (never a cascade). */}
      <SectionHeader
        title="Categories"
        note={
          selecting
            ? 'Tap more chips to multi-select, then Delete.'
            : 'Long-press to select categories, then Delete — tap more to multi-select. Deleting removes them from the pickers only; expenses using them keep their label.'
        }
        trailing={
          selecting ? (
            <>
              <Pressable
                onPress={() => setConfirmDeleteCats(true)}
                disabled={selectedCats.size === 0 || categoryBusy}
                style={({ pressed }) => [
                  styles.headerDelete,
                  selectedCats.size === 0 && styles.headerDeleteDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                testID="settings-categories-delete"
              >
                <Ionicons name="trash-outline" size={15} color={colors.surface} />
                <Text style={styles.headerDeleteLabel}>Delete ({selectedCats.size})</Text>
              </Pressable>
              <Pressable
                onPress={exitSelect}
                style={({ pressed }) => [styles.headerDone, pressed && styles.pressed]}
                accessibilityRole="button"
                testID="settings-categories-exit"
              >
                <Text style={styles.headerDoneLabel}>Done</Text>
              </Pressable>
            </>
          ) : undefined
        }
      />
      <View style={styles.chipWrap}>
        {visibleCategories.map((category) => {
          const selected = selecting && selectedCats.has(category.id);
          return (
            <Pressable
              key={category.id}
              onLongPress={() => enterSelect(category)}
              onPress={() => toggleSelect(category)}
              delayLongPress={450}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityHint="Long-press to select for deletion"
              testID={`settings-category-${category.id}`}
            >
              <Ionicons name={category.icon as never} size={14} color={selected ? colors.surface : colors.accent} />
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{category.name}</Text>
              {selected ? <Ionicons name="checkmark-circle" size={14} color={colors.surface} /> : null}
            </Pressable>
          );
        })}
        {/* The "+" chip replaces the Other slot. */}
        <Pressable
          onPress={() => setAddCategoryOpen(true)}
          style={({ pressed }) => [styles.chip, styles.addChip, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Add a new category"
          testID="settings-categories-add"
        >
          <Ionicons name="add" size={15} color={colors.accent} />
          <Text style={[styles.chipLabel, styles.addChipLabel]}>Add</Text>
        </Pressable>
      </View>

      <CategoryAddSheet
        visible={addCategoryOpen}
        onSave={async (name, icon) => {
          const created = await services.categories.create(name, icon);
          setCategories((prev) => [...prev, created]);
          setAddCategoryOpen(false);
        }}
        onCancel={() => setAddCategoryOpen(false)}
      />

      <ConfirmSheet
        visible={confirmDeleteCats}
        title={`Delete ${selectedCats.size} categor${selectedCats.size === 1 ? 'y' : 'ies'}?`}
        message="They are removed from the pickers only — expenses that already use them are left unchanged."
        confirmLabel="Delete"
        busy={categoryBusy}
        onConfirm={() => void doDeleteSelected()}
        onCancel={() => setConfirmDeleteCats(false)}
      />

      {/* Plan 008: AI Provider Config — testID="ai-config-section" wrapper */}
      <View testID="ai-config-section">
        {/* Plan 013: AI Providers (BYOK — Gemini + DeepSeek). */}
        <SectionHeader
          title="AI Provider"
          note="Bring your own API key to analyze your finances with AI. Keys are stored securely on this device and sent only to the provider."
        />
        {/* Plan 016 (SET-2): the AI status pills — key presence per provider (013's config). */}
        <View style={styles.aiStatusRow}>
          <Text
            style={[styles.aiStatus, aiSuffixes.gemini !== null && styles.aiStatusConfigured]}
            testID="settings-ai-status-gemini"
          >
            {aiStatusLabel('gemini', aiSuffixes.gemini !== null)}
          </Text>
          <Text
            style={[styles.aiStatus, aiSuffixes.deepseek !== null && styles.aiStatusConfigured]}
            testID="settings-ai-status-deepseek"
          >
            {aiStatusLabel('deepseek', aiSuffixes.deepseek !== null)}
          </Text>
        </View>
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
      </View>

      <Pressable
        onPress={logout}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
        accessibilityRole="button"
        testID="settings-logout"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.buttonLabel}>Log out</Text>
      </Pressable>

      <Text style={styles.footNote}>AI analysis through your own provider keys.</Text>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  title: { fontSize: typography.title, fontWeight: '800', color: colors.text, marginBottom: spacing.lg, letterSpacing: -0.3 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  label: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.xs, fontWeight: '600' },
  email: { fontSize: typography.body, fontWeight: '700', color: colors.text },
  empty: { fontSize: typography.body, color: colors.muted, marginBottom: spacing.md },
  errorText: { fontSize: typography.body, color: colors.danger, marginBottom: spacing.md },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  addButtonLabel: { color: colors.accent, fontSize: typography.emphasis, fontWeight: '700' },
  note: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.md, fontWeight: '500' },
  activeLabel: {
    fontSize: typography.caption,
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipLabel: { fontSize: typography.caption, color: colors.text, fontWeight: '600' },
  headerDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.danger,
    borderRadius: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 34,
  },
  headerDeleteDisabled: { opacity: 0.5 },
  headerDeleteLabel: { color: colors.surface, fontSize: typography.caption, fontWeight: '700' },
  headerDone: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    minHeight: 34,
  },
  headerDoneLabel: { color: colors.muted, fontSize: typography.caption, fontWeight: '600' },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabelSelected: { color: colors.surface, fontWeight: '700' },
  addChip: { borderStyle: 'dashed', borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.background },
  addChipLabel: { color: colors.accent },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    borderRadius: 12,
    minHeight: 48,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  buttonLabel: { color: colors.danger, fontSize: typography.emphasis, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  footNote: { marginTop: spacing.lg, fontSize: typography.caption, color: colors.muted, textAlign: 'center' },
  aiStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  aiStatus: {
    fontSize: typography.caption,
    color: colors.muted,
    fontWeight: '600',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  aiStatusConfigured: {
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
  },
});