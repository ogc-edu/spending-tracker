/**
 * Commitments tab (Plan 006 — Commitments & Subscriptions Screen Redesign)
 *
 * Overhauled into sleek Digital Passes representing the 3 obligation models:
 * 1. Fixed Amortizing Loan Pass: (testID="loan-card-{id}")
 *    - Displays payoff status, progress via BudgetMeter, remaining balance, months to maturity.
 * 2. Recurring Subscription Pass: (testID="subscription-card-{id}")
 *    - Displays monthly fee via MoneyDisplay, renewal countdown, auto-debit account.
 * 3. One-Off Obligation Pass: (testID="obligation-card-{id}")
 *    - Displays maturity date, total amount due via MoneyDisplay, settled status.
 *
 * Retains all preserved test contracts:
 * - testID="commitment-row-{id}", testID="commitment-name-{id}", testID="commitment-next-due-{id}"
 * - testID="commitments-screen", testID="commitments-list"
 * - testID="commitments-archived-toggle", testID="commitment-restore-{id}", testID="add-commitment-fab"
 * - testID="commitments-empty", testID="commitments-loading", testID="commitments-error"
 *
 * Automated "Mark as Paid" ledger synchronization workflow:
 * - Linked expense created, funding account debited, commitment marked paid, remaining balance updated.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Commitment, CommitmentPayment } from '@/db/schema';
import { CommitmentService } from '@/services/CommitmentService';
import { AccountService } from '@/services/AccountService';
import {
  commitmentSchedule,
  compareByNextDue,
  type CommitmentLike,
  type ScheduledPayment,
} from '@/engine/commitments';
import { useUiStore } from '@/store/uiStore';
import { addMonthsClamped, formatDayLabel, todayLocal } from '@/utils/dates';
import { colors, spacing, typography } from '@/theme';
import { COMMITMENT_TYPE_ICONS } from '@/components/commitmentMeta';
import { categoryColor } from '@/components/categoryMeta';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/ui/Fab';
import { InlineError } from '@/components/ui/InlineError';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { BentoCard } from '@/components/ui/BentoCard';
import { BudgetMeter } from '@/components/ui/BudgetMeter';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { StatusPill } from '@/components/ui/StatusPill';
import { PaymentFlowSheet } from '@/components/PaymentFlowSheet';
import { useToast } from '@/components/ToastProvider';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function daysUntilDue(todayStr: string, dueStr: string): number {
  const [y1, m1, d1] = todayStr.split('-').map(Number);
  const [y2, m2, d2] = dueStr.split('-').map(Number);
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((ms2 - ms1) / (1000 * 60 * 60 * 24));
}

type ObligationKind = 'loan' | 'subscription' | 'obligation';

function getObligationKind(commitment: Commitment): ObligationKind {
  if (commitment.frequency === 'one_time') return 'obligation';
  if (commitment.totalSen !== null) return 'loan';
  return 'subscription';
}

/**
 * A bounded schedule for any commitment shape. Ongoing commitments are an
 * infinite series — the engine refuses to derive one without a window end
 * (ARCH §7), so the list bounds them at today + 12 months.
 */
function scheduleFor(commitment: Commitment): ScheduledPayment[] {
  const to = commitment.totalSen === null ? addMonthsClamped(todayLocal(), 12) : undefined;
  return commitmentSchedule(commitment as CommitmentLike, undefined, to);
}

export default function CommitmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authService } = useAuth();
  const toast = useToast();
  const lastUsedAccountId = useUiStore((s) => s.lastUsedAccountId);

  const repos = useMemo(() => repositories(), []);
  const service = useMemo(() => {
    return new CommitmentService(repos.commitments, authService);
  }, [repos.commitments, authService]);

  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [archived, setArchived] = useState<Commitment[]>([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [payments, setPayments] = useState<CommitmentPayment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Mark as Paid flow sheet
  const [payingState, setPayingState] = useState<{
    commitment: Commitment;
    slot: ScheduledPayment;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const accountService = repos.accounts
        ? new AccountService(repos.accounts, authService)
        : null;

      const [rows, arch, paid, accs] = await Promise.all([
        service.list(),
        service.listArchived(),
        service.allPaidPayments(),
        accountService ? accountService.list() : Promise.resolve([]),
      ]);
      setCommitments(rows);
      setArchived(arch);
      setPayments(paid);
      setAccounts(accs);
      setError(null);
    } catch (loadError: unknown) {
      setError(errMsg(loadError));
    } finally {
      setLoading(false);
    }
  }, [service, repos.accounts, authService]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  /** dueDate of the first unpaid slot, or null (all paid / no schedule). */
  const nextDue = useCallback(
    (commitment: Commitment): string | null => {
      const paidKeys = new Set(
        payments.filter((p) => p.commitmentId === commitment.id).map((p) => p.dueDate),
      );
      const unpaid = scheduleFor(commitment).find((slot) => !paidKeys.has(slot.dueDate));
      return unpaid?.dueDate ?? null;
    },
    [payments],
  );

  /**
   * Default order: soonest obligation first (overdue at the top, "All paid"
   * at the bottom) — the comparator is the engine's, this only feeds it the
   * derived next-due dates.
   */
  const orderByNextDue = useCallback(
    (rows: Commitment[]): Commitment[] =>
      [...rows].sort((a, b) =>
        compareByNextDue(
          { nextDue: nextDue(a), name: a.name, id: a.id },
          { nextDue: nextDue(b), name: b.name, id: b.id },
        ),
      ),
    [nextDue],
  );

  const orderedCommitments = useMemo(() => orderByNextDue(commitments), [commitments, orderByNextDue]);
  const orderedArchived = useMemo(() => orderByNextDue(archived), [archived, orderByNextDue]);

  const handleRestore = (commitment: Commitment) => {
    setBusy(true);
    service
      .unarchive(commitment.id)
      .then(() => load())
      .catch((restoreError: unknown) => toast.show(`Could not restore commitment: ${errMsg(restoreError)}`))
      .finally(() => setBusy(false));
  };

  const today = todayLocal();

  const getAutoDebitAccount = (commitment: Commitment): string => {
    const lastUsed = accounts.find((a) => a.id === lastUsedAccountId);
    if (lastUsed) return lastUsed.name;
    if (accounts.length > 0) return accounts[0].name;
    return "Touch 'n Go";
  };

  const handleOpenMarkPaid = (commitment: Commitment, dueDate: string) => {
    const slot = scheduleFor(commitment).find((s) => s.dueDate === dueDate) ?? {
      dueDate,
      amountSen: commitment.paymentSen,
      index: 0,
    };
    setPayingState({ commitment, slot });
  };

  const handleConfirmMarkPaid = async (accountId: number | null) => {
    if (!payingState) return;
    setBusy(true);
    try {
      await service.markPaid(payingState.commitment.id, payingState.slot.dueDate, accountId);
      if (accountId !== null) useUiStore.getState().setLastUsedAccount(accountId);
      setPayingState(null);
      toast.show('Payment marked paid');
      await load();
    } catch (paymentError: unknown) {
      toast.show(`Could not mark payment paid: ${errMsg(paymentError)}`);
    } finally {
      setBusy(false);
    }
  };

  const renderDigitalPass = (commitment: Commitment) => {
    const kind = getObligationKind(commitment);
    const due = nextDue(commitment);
    const overdue = due !== null && due < today;
    const canMarkPaid = commitment.status === 'active' && commitment.archivedAt === null;
    const iconName = (COMMITMENT_TYPE_ICONS[commitment.type as keyof typeof COMMITMENT_TYPE_ICONS] ?? 'calendar-outline') as never;

    if (kind === 'loan') {
      const totalSen = commitment.totalSen ?? 0;
      const remainingSen = commitment.remainingSen;
      const paidSen = Math.max(0, totalSen - remainingSen);
      const paidKeys = new Set(
        payments.filter((p) => p.commitmentId === commitment.id).map((p) => p.dueDate),
      );
      const unpaidSlots = scheduleFor(commitment).filter((slot) => !paidKeys.has(slot.dueDate));
      const monthsLeft = unpaidSlots.length;
      const payoffPercent = totalSen > 0 ? (paidSen / totalSen) * 100 : remainingSen === 0 ? 100 : 0;

      return (
        <Pressable
          key={commitment.id}
          onPress={() => router.push(`/commitments/${commitment.id}` as never)}
          style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
          accessibilityRole="button"
          testID={`commitment-row-${commitment.id}`}
        >
          <BentoCard
            testID={`loan-card-${commitment.id}`}
            className="border border-border/60 bg-card rounded-2xl p-4"
          >
            {/* Header: Icon, Name, Status Pill */}
            <View className="flex-row items-center gap-2.5">
              <View
                style={[styles.iconWrap, { backgroundColor: `${categoryColor(commitment.id)}22` }]}
              >
                <Ionicons name={iconName} size={20} color={categoryColor(commitment.id)} />
              </View>
              <Text
                style={styles.name}
                numberOfLines={1}
                testID={`commitment-name-${commitment.id}`}
              >
                {commitment.name}
              </Text>
              <StatusPill
                variant={
                  commitment.status === 'completed'
                    ? 'healthy'
                    : commitment.status === 'cancelled'
                      ? 'neutral'
                      : overdue
                        ? 'danger'
                        : 'accent'
                }
                label={
                  commitment.status === 'completed'
                    ? 'Paid Off'
                    : commitment.status === 'cancelled'
                      ? 'Cancelled'
                      : overdue
                        ? 'Overdue'
                        : 'Active'
                }
                dot
              />
            </View>

            {/* Hairline Divider */}
            <View className="border-t border-border/40 my-3" />

            {/* Repayment and Next Due */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="text-xs text-muted-foreground font-medium">Repayment:</Text>
                <MoneyDisplay amountInSen={commitment.paymentSen} size="sm" />
                <Text className="text-xs text-muted-foreground font-medium">/ month</Text>
              </View>
              <Text
                testID={`commitment-next-due-${commitment.id}`}
                className={`text-xs ${overdue ? 'text-destructive font-bold' : 'text-muted-foreground font-semibold'}`}
              >
                {due !== null
                  ? `${overdue ? 'Overdue · ' : 'Next due · '}${formatDayLabel(due)}`
                  : 'All paid'}
              </Text>
            </View>

            {/* Balance and Progress */}
            <View className="flex-row items-center justify-between mt-2 flex-wrap gap-1">
              <View className="flex-row items-center gap-1 flex-wrap">
                <Text className="text-xs text-muted-foreground font-medium">Balance:</Text>
                <MoneyDisplay amountInSen={remainingSen} size="xs" />
                <Text className="text-xs text-muted-foreground font-medium">/</Text>
                <MoneyDisplay amountInSen={totalSen} size="xs" />
                <Text className="text-xs text-muted-foreground font-medium">
                  ({monthsLeft} {monthsLeft === 1 ? 'mo' : 'mos'} left)
                </Text>
              </View>
              <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {payoffPercent.toFixed(1)}% Paid Off
              </Text>
            </View>
            <BudgetMeter
              spentSen={paidSen}
              totalSen={totalSen}
              customColor="bg-emerald-500"
              heightClass="h-2"
              className="mt-2"
            />

            {/* Mark as Paid Action */}
            {canMarkPaid && due !== null ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleOpenMarkPaid(commitment, due);
                }}
                disabled={busy}
                accessibilityRole="button"
                className="mt-3 flex-row items-center justify-center gap-1.5 bg-emerald-600 dark:bg-emerald-500 rounded-xl py-2 px-3 min-h-[44px]"
                testID={`mark-paid-button-${commitment.id}`}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color="#ffffff" />
                <Text className="text-white text-xs font-bold">Mark as Paid</Text>
              </Pressable>
            ) : null}
          </BentoCard>
        </Pressable>
      );
    }

    if (kind === 'subscription') {
      const daysUntil = due ? daysUntilDue(today, due) : null;
      let renewalCountdown = 'All paid';
      if (due !== null && daysUntil !== null) {
        if (daysUntil < 0) renewalCountdown = `Overdue · ${formatDayLabel(due)}`;
        else if (daysUntil === 0) renewalCountdown = 'Renews today';
        else if (daysUntil === 1) renewalCountdown = 'Renews in 1 day';
        else renewalCountdown = `Renews in ${daysUntil} days`;
      }

      return (
        <Pressable
          key={commitment.id}
          onPress={() => router.push(`/commitments/${commitment.id}` as never)}
          style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
          accessibilityRole="button"
          testID={`commitment-row-${commitment.id}`}
        >
          <BentoCard
            testID={`subscription-card-${commitment.id}`}
            className="border border-border/60 bg-card rounded-2xl p-4"
          >
            {/* Header */}
            <View className="flex-row items-center gap-2.5">
              <View
                style={[styles.iconWrap, { backgroundColor: `${categoryColor(commitment.id)}22` }]}
              >
                <Ionicons name={iconName} size={20} color={categoryColor(commitment.id)} />
              </View>
              <Text
                style={styles.name}
                numberOfLines={1}
                testID={`commitment-name-${commitment.id}`}
              >
                {commitment.name}
              </Text>
              <StatusPill
                variant={
                  commitment.status === 'cancelled'
                    ? 'neutral'
                    : overdue
                      ? 'danger'
                      : 'accent'
                }
                label={
                  commitment.status === 'cancelled'
                    ? 'Cancelled'
                    : overdue
                      ? 'Overdue'
                      : 'Active'
                }
                dot
              />
            </View>

            {/* Hairline Divider */}
            <View className="border-t border-border/40 my-3" />

            {/* Monthly Fee and Renewal Countdown */}
            <View className="flex-row items-center justify-between flex-wrap gap-1">
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="text-xs text-muted-foreground font-medium">Monthly Fee:</Text>
                <MoneyDisplay amountInSen={commitment.paymentSen} size="sm" />
                <Text className="text-xs text-muted-foreground font-medium">•</Text>
                <Text
                  testID={`commitment-next-due-${commitment.id}`}
                  className={`text-xs ${overdue ? 'text-destructive font-bold' : 'text-muted-foreground font-semibold'}`}
                >
                  {renewalCountdown}
                </Text>
              </View>
            </View>

            {/* Auto-debit Account */}
            <Text className="text-xs text-muted-foreground mt-2 font-medium">
              Auto-debit Account:{' '}
              <Text className="text-foreground font-semibold">
                {getAutoDebitAccount(commitment)}
              </Text>
            </Text>

            {/* Mark as Paid Action */}
            {canMarkPaid && due !== null ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleOpenMarkPaid(commitment, due);
                }}
                disabled={busy}
                accessibilityRole="button"
                className="mt-3 flex-row items-center justify-center gap-1.5 bg-emerald-600 dark:bg-emerald-500 rounded-xl py-2 px-3 min-h-[44px]"
                testID={`mark-paid-button-${commitment.id}`}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color="#ffffff" />
                <Text className="text-white text-xs font-bold">Mark as Paid</Text>
              </Pressable>
            ) : null}
          </BentoCard>
        </Pressable>
      );
    }

    // One-Off Obligation Pass
    return (
      <Pressable
        key={commitment.id}
        onPress={() => router.push(`/commitments/${commitment.id}` as never)}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
        accessibilityRole="button"
        testID={`commitment-row-${commitment.id}`}
      >
        <BentoCard
          testID={`obligation-card-${commitment.id}`}
          className="border border-border/60 bg-card rounded-2xl p-4"
        >
          {/* Header */}
          <View className="flex-row items-center gap-2.5">
            <View
              style={[styles.iconWrap, { backgroundColor: `${categoryColor(commitment.id)}22` }]}
            >
              <Ionicons name={iconName} size={20} color={categoryColor(commitment.id)} />
            </View>
            <Text
              style={styles.name}
              numberOfLines={1}
              testID={`commitment-name-${commitment.id}`}
            >
              {commitment.name}
            </Text>
            <StatusPill
              variant={
                commitment.status === 'completed' || due === null
                  ? 'healthy'
                  : commitment.status === 'cancelled'
                    ? 'neutral'
                    : overdue
                      ? 'danger'
                      : 'accent'
              }
              label={
                commitment.status === 'completed' || due === null
                  ? 'Settled'
                  : commitment.status === 'cancelled'
                    ? 'Cancelled'
                    : overdue
                      ? 'Overdue'
                      : 'Active'
              }
              dot
            />
          </View>

          {/* Hairline Divider */}
          <View className="border-t border-border/40 my-3" />

          {/* Maturity Date and Total Amount Due */}
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground font-medium">Maturity Date:</Text>
            <Text
              testID={`commitment-next-due-${commitment.id}`}
              className={`text-xs ${overdue ? 'text-destructive font-bold' : 'text-muted-foreground font-semibold'}`}
            >
              {due !== null
                ? overdue
                  ? `Overdue · ${formatDayLabel(due)}`
                  : formatDayLabel(due)
                : 'Settled'}
            </Text>
          </View>

          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-xs text-muted-foreground font-medium">Total Amount Due:</Text>
            <MoneyDisplay amountInSen={commitment.paymentSen} size="sm" />
          </View>

          {/* Mark as Paid Action */}
          {canMarkPaid && due !== null ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleOpenMarkPaid(commitment, due);
              }}
              disabled={busy}
              accessibilityRole="button"
              className="mt-3 flex-row items-center justify-center gap-1.5 bg-emerald-600 dark:bg-emerald-500 rounded-xl py-2 px-3 min-h-[44px]"
              testID={`mark-paid-button-${commitment.id}`}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#ffffff" />
              <Text className="text-white text-xs font-bold">Mark as Paid</Text>
            </Pressable>
          ) : null}
        </BentoCard>
      </Pressable>
    );
  };

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
      testID="commitments-screen"
    >
      {error ? <InlineError message={error} testID="commitments-error" /> : null}

      {loading ? (
        <View style={styles.centerBox} testID="commitments-loading">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 88 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.muted}
            />
          }
        >
          {commitments.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No commitments"
              body="Debts, bills, rent and installments — mark payments paid as they happen."
              action={{
                label: 'Add commitment',
                onPress: () => router.push('/commitments/new' as never),
              }}
              testID="commitments-empty"
            />
          ) : (
            <View testID="commitments-list" className="gap-3">
              {orderedCommitments.map(renderDigitalPass)}
            </View>
          )}

          {archived.length > 0 ? (
            <View className="mt-6">
              {/* Collapsed by default — one tappable section row; tap to expand. */}
              <Pressable
                onPress={() => setArchivedOpen((v) => !v)}
                style={({ pressed }) => [styles.archivedHeader, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ expanded: archivedOpen }}
                accessibilityLabel={`Archived, ${archived.length} commitment${archived.length === 1 ? '' : 's'}`}
                testID="commitments-archived-toggle"
              >
                <Ionicons
                  name={archivedOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.muted}
                />
                <Text style={styles.archivedHeaderLabel}>
                  Archived ({archived.length})
                </Text>
                <Text style={styles.archivedHeaderHint}>
                  {archivedOpen ? 'Tap to hide' : 'Kept for history — tap to show'}
                </Text>
              </Pressable>
              {archivedOpen ? (
                <>
                  <Text style={styles.sectionNote}>
                    Restore anytime — payments and expenses stay intact.
                  </Text>
                  {orderedArchived.map((commitment) => (
                    <View key={commitment.id} style={styles.archivedRow}>
                      <Text style={[styles.name, styles.archivedName]} numberOfLines={1}>
                        {commitment.name}
                      </Text>
                      <Pressable
                        onPress={() => handleRestore(commitment)}
                        disabled={busy}
                        style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}
                        accessibilityRole="button"
                        testID={`commitment-restore-${commitment.id}`}
                      >
                        <Ionicons name="refresh-outline" size={14} color={colors.accent} />
                        <Text style={styles.restoreLabel}>Restore</Text>
                      </Pressable>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          ) : null}

          <View style={styles.spacer} />
        </ScrollView>
      )}

      <Fab
        onPress={() => router.push('/commitments/new' as never)}
        label="Add commitment"
        testID="add-commitment-fab"
      />

      <PaymentFlowSheet
        visible={payingState !== null}
        slot={payingState?.slot ?? { dueDate: '', amountSen: 0, index: 0 }}
        accounts={accounts}
        initialAccountId={
          lastUsedAccountId !== null && accounts.some((a) => a.id === lastUsedAccountId)
            ? lastUsedAccountId
            : accounts[0]?.id ?? null
        }
        busy={busy}
        onConfirm={handleConfirmMarkPaid}
        onCancel={() => setPayingState(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: spacing.md,
  },
  centerBox: { alignItems: 'center', paddingTop: spacing.xxl * 2, paddingHorizontal: 16 },
  cardPressable: {
    marginBottom: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: typography.body, fontWeight: '700', color: colors.text, flex: 1 },
  archivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  archivedHeaderLabel: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  archivedHeaderHint: { flex: 1, fontSize: typography.caption, color: colors.muted, textAlign: 'right' },
  sectionNote: {
    fontSize: typography.caption,
    color: colors.muted,
    marginBottom: spacing.md,
    fontWeight: '500',
  },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
  },
  archivedName: { flex: 1, color: colors.muted, fontWeight: '500' },
  restoreButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, paddingHorizontal: 8 },
  restoreLabel: { color: colors.accent, fontSize: typography.caption, fontWeight: '700' },
  spacer: { height: spacing.lg },
  pressed: { opacity: 0.8 },
});