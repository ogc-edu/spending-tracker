/**
 * Settings screen (plans 003 + 004 + 013). 003: signed-in user + logout.
 * 004: the ACCOUNTS section (list with credit-card "Owed", add-at-form via
 * AccountForm, FK-protected delete) plus a read-only CATEGORIES preview that
 * proves the seeded-repository path (the real consumer is the 005 expense form).
 * 013: the AI Providers section — Gemini/DeepSeek BYOK rows (Not configured /
 * masked key suffix) and the Active AI Provider selector (configured only;
 * no automatic fallback).
 *
 * Payroll: the standing split of the user's pay across accounts, plus the
 * "Payroll in" button that credits every allocated account in one go. It sits
 * here because it is account configuration, and the action it drives is the
 * monthly counterpart to the balances listed right above it.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category } from '@/db/schema';
import { AccountService } from '@/services/AccountService';
import { CategoryService } from '@/services/CategoryService';
import { PayrollService, type PayrollPlan } from '@/services/PayrollService';
import { SettingsService } from '@/services/SettingsService';
import { AiConfigService, type ConfigurableAIProvider } from '@/services/AiConfigService';
import type { AccountInput } from '@/repositories/types';
import type { AIProviderName } from '@/ai/types';
import { AccountForm } from '@/components/AccountForm';
import { AccountBalanceSheet } from '@/components/AccountBalanceSheet';
import { AccountRow } from '@/components/AccountRow';
import { PayrollAllocationSheet } from '@/components/PayrollAllocationSheet';
import { CategoryAddSheet } from '@/components/CategoryAddSheet';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { List } from '@/components/ui/List';
import { ProviderRow, maskKeySuffix } from '@/components/ai/ProviderRow';
import { ActiveProviderSelector } from '@/components/ai/ActiveProviderSelector';
import { aiStatusLabel } from '@/components/ai/providerMeta';
import { KeyboardAwareScrollView, useKeyboardAwareFocus } from '@/components/KeyboardAwareScrollView';
import { useToast } from '@/components/ToastProvider';
import { formatDDMMYYYY, toLocalDateString } from '@/utils/dates';
import { formatSen, parseMoneyToSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography, shadows } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, authService } = useAuth();
  const toast = useToast();

  // Services built once auth is available; repositories() needs the initialized DB.
  const services = useMemo(() => {
    const repos = repositories();
    return {
      accounts: new AccountService(repos.accounts, authService),
      categories: new CategoryService(repos.categories),
      settings: new SettingsService(repos.settings, authService),
      payroll: new PayrollService(repos.payroll, repos.accounts, authService),
      ai: new AiConfigService(repos.settings, authService),
    };
  }, [authService]);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  /** The account whose balance sheet is open (null = closed). */
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Payroll-in: the split, the allocation sheet, and the deposit confirm.
  const [payroll, setPayroll] = useState<PayrollPlan | null>(null);
  const [payrollSheet, setPayrollSheet] = useState<
    { mode: 'add' } | { mode: 'edit'; accountId: number; amountSen: number } | null
  >(null);
  const [confirmPayroll, setConfirmPayroll] = useState(false);
  // Text inputs report focus so the screen's scroller lifts them clear of the keyboard.
  const onInputFocus = useKeyboardAwareFocus();
  const [payrollBusy, setPayrollBusy] = useState(false);
  /** Nothing to deposit (or a deposit already in flight). */
  const payrollDisabled = payroll === null || payroll.lines.length === 0 || payrollBusy;
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

  // Plan 016 (SET-1 completion): the safety-buffer editor. bufferSen is the
  // persisted value (default 30000 = RM300 until overridden); bufferInput is
  // the in-progress edit; bufferError is the inline validation message.
  const [bufferSen, setBufferSen] = useState<number | null>(null);
  const [bufferInput, setBufferInput] = useState('');
  const [bufferError, setBufferError] = useState<string | null>(null);
  const [bufferBusy, setBufferBusy] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await services.accounts.list());
      setAccountsError(null);
    } catch (error: unknown) {
      setAccountsError(errMsg(error));
    }
  }, [services.accounts]);

  const loadPayroll = useCallback(async () => {
    try {
      setPayroll(await services.payroll.plan());
    } catch (error: unknown) {
      toast.show(`Could not load payroll: ${errMsg(error)}`);
    }
  }, [services.payroll, toast]);

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

  const loadBuffer = useCallback(async () => {
    try {
      setBufferSen(await services.settings.getBuffer());
    } catch {
      // Keep the previous state; non-fatal (read failure).
    }
  }, [services.settings]);

  /**
   * SET-1 save: the money string parses via parseMoneyToSen (negative and
   * junk rejected inline); 0 is a legitimate "no buffer" choice (plan §Edge
   * cases); the service re-validates at its boundary. Write failures toast.
   */
  const saveBuffer = async () => {
    const trimmed = bufferInput.trim();
    if (trimmed === '') {
      setBufferError('Enter an amount');
      return;
    }
    let sen: number;
    try {
      sen = parseMoneyToSen(trimmed);
    } catch {
      setBufferError('Enter a valid amount (up to 2 decimal places)');
      return;
    }
    setBufferError(null);
    setBufferBusy(true);
    try {
      const saved = await services.settings.setBuffer(sen);
      setBufferSen(saved.safetyBufferSen);
      setBufferInput('');
    } catch (error: unknown) {
      toast.show(`Could not save safety buffer: ${errMsg(error)}`);
    } finally {
      setBufferBusy(false);
    }
  };

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
      void loadPayroll();
    }, [loadPayroll]),
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

  useFocusEffect(
    useCallback(() => {
      void loadBuffer();
    }, [loadBuffer]),
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

  /** Save one slice of the split (add or edit) — the sheet shows any error. */
  const handleSaveAllocation = async (accountId: number, amountSen: number) => {
    await services.payroll.setAllocation(accountId, amountSen);
    setPayrollSheet(null);
    await loadPayroll();
  };

  const handleRemoveAllocation = async (accountId: number) => {
    try {
      await services.payroll.removeAllocation(accountId);
      await loadPayroll();
    } catch (error: unknown) {
      toast.show(`Could not remove allocation: ${errMsg(error)}`);
    }
  };

  /** The button: credit every allocated account, once, after confirming. */
  const handlePayrollIn = async () => {
    setPayrollBusy(true);
    try {
      const { depositedSen } = await services.payroll.deposit(new Date());
      setConfirmPayroll(false);
      await Promise.all([loadAccounts(), loadPayroll()]);
      toast.show(`Payroll in: ${formatSen(depositedSen)} added across your accounts`);
    } catch (error: unknown) {
      toast.show(`Could not record payroll: ${errMsg(error)}`);
    } finally {
      setPayrollBusy(false);
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
      contentContainerStyle={styles.content}
      testID="settings-screen"
    >
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
      <SectionHeader title="Accounts" />

      {accountsError ? (
        <Text style={styles.errorText} testID="accounts-error">
          {accountsError}
        </Text>
      ) : null}

      {accounts.length === 0 && !accountsError ? (
        <Text style={styles.empty}>No accounts yet — add one to start tracking money.</Text>
      ) : (
        <List testID="settings-accounts-list">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              onPress={() => setEditingAccount(account)}
              onDelete={() => handleDelete(account)}
            />
          ))}
        </List>
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

      {/* Payroll in — the standing split, and the button that applies it. */}
      <SectionHeader
        title="Payroll"
        note="Split each payroll across your accounts, then press Payroll in when you are paid — every account below is credited by its amount. Balances move; your expense history does not."
      />

      {payroll && payroll.lines.length > 0 ? (
        <View style={styles.card}>
          {payroll.lines.map((line) => (
            <View key={line.allocation.id} style={styles.payrollRow} testID={`payroll-line-${line.account.id}`}>
              <Pressable
                onPress={() =>
                  setPayrollSheet({
                    mode: 'edit',
                    accountId: line.account.id,
                    amountSen: line.allocation.amountSen,
                  })
                }
                style={({ pressed }) => [styles.payrollRowMain, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${line.account.name}, ${formatSen(line.allocation.amountSen)} per payroll`}
                accessibilityHint="Edit this allocation"
                testID={`payroll-line-edit-${line.account.id}`}
              >
                <Text style={styles.payrollName} numberOfLines={1}>
                  {line.account.name}
                </Text>
                <Text style={styles.payrollAmount}>{formatSen(line.allocation.amountSen)}</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleRemoveAllocation(line.account.id)}
                style={({ pressed }) => [styles.payrollRemove, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${line.account.name} from the payroll split`}
                testID={`payroll-line-remove-${line.account.id}`}
              >
                <Ionicons name="close-circle-outline" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))}
          <View style={styles.payrollTotalRow}>
            <Text style={styles.payrollTotalLabel}>Total per payroll</Text>
            <Text
              style={styles.payrollTotalValue}
              accessibilityLabel={`Total per payroll, ${spokenMoneyLabel(payroll.totalSen)}`}
              testID="payroll-total"
            >
              {formatSen(payroll.totalSen)}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.empty} testID="payroll-empty">
          No allocations yet — add one to tell the app where your pay goes.
        </Text>
      )}

      {/* Two compact pills rather than full-width slabs: the deposit moves real
          money, so it should take a deliberate tap, not a thumb brushing a
          banner. It still confirms before anything is written. */}
      <View style={styles.payrollActions}>
        <Pressable
          onPress={() => setPayrollSheet({ mode: 'add' })}
          style={({ pressed }) => [styles.payrollAddButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Add a payroll allocation"
          testID="payroll-add-allocation"
        >
          <Ionicons name="add" size={16} color={colors.accent} />
          <Text style={styles.payrollAddLabel}>Add allocation</Text>
        </Pressable>

        <Pressable
          onPress={() => setConfirmPayroll(true)}
          disabled={payrollDisabled}
          style={({ pressed }) => [
            styles.payrollButton,
            payrollDisabled && styles.buttonDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            payroll && payroll.lines.length > 0
              ? `Payroll in, add ${formatSen(payroll.totalSen)} across your accounts`
              : 'Payroll in, no allocations yet'
          }
          accessibilityHint="Asks you to confirm first"
          testID="payroll-in-button"
        >
          <Ionicons name="download-outline" size={16} color={colors.surface} />
          <Text style={styles.payrollButtonLabel}>Payroll in</Text>
        </Pressable>
      </View>

      {payroll?.lastRunAt ? (
        <Text style={styles.note} testID="payroll-last-run">
          Last payroll in: {formatDDMMYYYY(toLocalDateString(new Date(payroll.lastRunAt)))}
        </Text>
      ) : null}

      <PayrollAllocationSheet
        // Remount per open so the account/amount prefill re-reads.
        key={
          payrollSheet
            ? `payroll-${payrollSheet.mode}-${'accountId' in payrollSheet ? payrollSheet.accountId : 'new'}`
            : 'payroll-closed'
        }
        visible={payrollSheet !== null}
        accounts={accounts.filter((account) => account.type !== 'credit_card')}
        editing={payrollSheet?.mode === 'edit' ? payrollSheet : null}
        onSave={handleSaveAllocation}
        onCancel={() => setPayrollSheet(null)}
      />

      <ConfirmSheet
        visible={confirmPayroll}
        title="Record payroll in"
        message={
          payroll
            ? [
                ...payroll.lines.map((line) => `${line.account.name}  +${formatSen(line.allocation.amountSen)}`),
                '',
                `Total ${formatSen(payroll.totalSen)}. Press once per payroll — each press deposits again.`,
              ].join('\n')
            : ''
        }
        confirmLabel="Payroll in"
        busy={payrollBusy}
        onConfirm={() => void handlePayrollIn()}
        onCancel={() => setConfirmPayroll(false)}
      />

      <AccountBalanceSheet
        // Remount per account so the sheet prefills with that row's figure.
        key={editingAccount ? `balance-${editingAccount.id}` : 'balance-closed'}
        account={editingAccount}
        onSave={handleAdjustBalance}
        onCancel={() => setEditingAccount(null)}
      />

      {/* Plan 016 (SET-1): safety-buffer editor — the promised SET-1 surface. */}
      <SectionHeader
        title="Safety buffer"
        note="Reserved from your available money before safe-to-spend is calculated. RM0 means no buffer."
      />
      <View style={styles.card}>
        <Text style={styles.label}>Current buffer</Text>
        <Text
          style={styles.bufferCurrent}
          numberOfLines={1}
          accessibilityLabel={`Safety buffer, ${spokenMoneyLabel(bufferSen ?? 0)}`}
          testID="settings-buffer-current"
        >
          {bufferSen === null ? '…' : formatSen(bufferSen)}
        </Text>
        <View style={styles.bufferRow}>
          <TextInput
            style={styles.bufferInput}
            keyboardType="decimal-pad"
            placeholder="e.g. 300"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Safety buffer amount in ringgit"
            value={bufferInput}
            onChangeText={(text) => {
              setBufferInput(text);
              setBufferError(null);
            }}
            onFocus={onInputFocus}
            editable={!bufferBusy}
            testID="settings-buffer-input"
          />
          <Pressable
            onPress={() => void saveBuffer()}
            disabled={bufferBusy}
            style={({ pressed }) => [styles.bufferSave, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Save safety buffer"
            testID="settings-buffer-save"
          >
            <Text style={styles.bufferSaveLabel}>Save</Text>
          </Pressable>
        </View>
        {bufferError ? (
          <Text style={styles.fieldError} testID="settings-buffer-error">
            {bufferError}
          </Text>
        ) : null}
        <Text style={styles.note}>0 is allowed — it simply means no money is held back.</Text>
      </View>

      {/* Plan 016 follow-up: Categories manager — long-press a chip to select
        (multi-select), Delete appears on the header row; the "+" chip
        (Other's slot) opens the add sheet. Delete is list-only: existing
        expenses/budgets keep their category label (never a cascade). */}
      <SectionHeader
        title="Categories"
        note={
          selecting
            ? 'Tap more chips to multi-select, then Delete.'
            : 'Long-press to select categories, then Delete — tap more to multi-select. Deleting removes them from the pickers only; expenses and budgets using them keep their label.'
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
        message="They are removed from the pickers only — expenses and budgets that already use them are left unchanged."
        confirmLabel="Delete"
        busy={categoryBusy}
        onConfirm={() => void doDeleteSelected()}
        onCancel={() => setConfirmDeleteCats(false)}
      />

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
    ...shadows.card,
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
  payrollRow: { flexDirection: 'row', alignItems: 'center' },
  payrollRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44, // touch target (plan 016 a11y)
    gap: spacing.md,
  },
  payrollName: { flex: 1, fontSize: typography.body, fontWeight: '600', color: colors.text },
  payrollAmount: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
    fontVariant: moneyFontVariant,
  },
  payrollRemove: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  payrollTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  payrollTotalLabel: { fontSize: typography.caption, color: colors.muted, fontWeight: '600' },
  payrollTotalValue: {
    fontSize: typography.emphasis,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: moneyFontVariant,
  },
  payrollActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  payrollAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    minHeight: 44, // touch target (plan 016 a11y) — width follows the label
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  payrollAddLabel: { color: colors.accent, fontSize: typography.body, fontWeight: '600' },
  payrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: 10,
    minHeight: 44, // touch target (plan 016 a11y) — width follows the label
    paddingHorizontal: spacing.lg,
  },
  payrollButtonLabel: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
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
  bufferCurrent: { fontSize: typography.moneySmall, fontWeight: '800', color: colors.text, marginBottom: spacing.sm, fontVariant: moneyFontVariant },
  bufferRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm },
  bufferInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    minHeight: 44, // touch target (plan 016 a11y)
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: colors.background,
  },
  bufferSave: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    minHeight: 44,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  bufferSaveLabel: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
  fieldError: { fontSize: typography.caption, color: colors.danger, marginBottom: spacing.sm },
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