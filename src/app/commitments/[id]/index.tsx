/**
 * Commitment detail (plan 008) — one commitment's full derived schedule.
 *
 * Rows come from the engine (service.schedule): UPCOMING slots offer Mark
 * paid → a PaymentFlowSheet whose account picker is prefilled with the
 * last-used account from uiStore (A5 — one tap); PAID rows show the linked
 * expense (paid date + paying account) plus Un-pay (E7 counterpart — the
 * ONLY way to remove a linked expense). Overdue upcoming rows are highlighted
 * in danger and never hidden.
 *
 * Status controls: Cancel (terminal — re-create instead of re-activate),
 * Delete per C1 (zero payments → hard delete; otherwise Archive with a clear
 * message that history is kept), and Restore for archived commitments.
 * Every value re-reads SQLite on focus (A4); mark-paid/un-pay/cancel/delete
 * all reload here. No SQL, no money math — services + engine only.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Commitment, CommitmentPayment, Expense } from '@/db/schema';
import { CommitmentService } from '@/services/CommitmentService';
import { AccountService } from '@/services/AccountService';
import type { ScheduledPayment } from '@/engine/commitments';
import { useUiStore } from '@/store/uiStore';
import { formatDayLabel, todayLocal } from '@/utils/dates';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { COMMITMENT_TYPE_ICONS, COMMITMENT_TYPE_LABELS } from '@/components/commitmentMeta';
import { ScheduleRow } from '@/components/ScheduleRow';
import { PaymentFlowSheet } from '@/components/PaymentFlowSheet';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useToast } from '@/components/ToastProvider';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** How many upcoming slots the compact schedule shows before "Show all" (plan 016 follow-up). */
const UPCOMING_PREVIEW_COUNT = 3;

export default function CommitmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authService } = useAuth();
  const toast = useToast();
  const commitmentId = Number(id);
  const lastUsedAccountId = useUiStore((s) => s.lastUsedAccountId);

  const services = useMemo(() => {
    const repos = repositories();
    return {
      commitments: new CommitmentService(repos.commitments, authService),
      accounts: new AccountService(repos.accounts, authService),
    };
  }, [authService]);

  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [schedule, setSchedule] = useState<ScheduledPayment[]>([]);
  const [payments, setPayments] = useState<CommitmentPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [payingSlot, setPayingSlot] = useState<ScheduledPayment | null>(null);
  // Plan 016: destructive confirms go through the shared ConfirmSheet;
  // each sheet's confirm button is disabled while `busy` (double-tap guard).
  const [confirmUnPay, setConfirmUnPay] = useState<CommitmentPayment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Plan 016 follow-up: monthly commitments default to a compact view —
  // the first 3 upcoming slots only; "Show all" expands the rest.
  const [showAllSchedule, setShowAllSchedule] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(commitmentId) || commitmentId <= 0) {
      setLoadError('Invalid commitment');
      setLoading(false);
      return;
    }
    try {
      const [row, slots, paid, linked, accs] = await Promise.all([
        services.commitments.byId(commitmentId),
        services.commitments.schedule(commitmentId),
        services.commitments.paymentsForCommitment(commitmentId),
        services.commitments.expensesForCommitment(commitmentId),
        services.accounts.list(),
      ]);
      setCommitment(row);
      setSchedule(slots);
      setPayments(paid);
      setExpenses(linked);
      setAccounts(accs);
      setLoadError(null);
    } catch (error: unknown) {
      setLoadError(errMsg(error));
    } finally {
      setLoading(false);
    }
  }, [commitmentId, services.commitments, services.accounts]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** Paid record per dueDate, plus the linked expense's paying account name. */
  const paidByDate = useMemo(() => {
    const byDate = new Map<string, CommitmentPayment>();
    for (const payment of payments) byDate.set(payment.dueDate, payment);
    return byDate;
  }, [payments]);

  const accountNameByPayment = useMemo(() => {
    const names = new Map<number, string>();
    for (const expense of expenses) {
      if (expense.accountId === null) continue;
      const account = accounts.find((a) => a.id === expense.accountId);
      if (account && expense.commitmentPaymentId !== null) {
        names.set(expense.commitmentPaymentId, account.name);
      }
    }
    return names;
  }, [expenses, accounts]);

  const handleMarkPaid = useCallback(
    async (accountId: number | null) => {
      if (!payingSlot) return;
      setBusy(true);
      try {
        await services.commitments.markPaid(commitmentId, payingSlot.dueDate, accountId);
        if (accountId !== null) useUiStore.getState().setLastUsedAccount(accountId);
        setPayingSlot(null);
        toast.show('Payment marked paid');
        await load();
      } catch (error: unknown) {
        toast.show(`Could not mark payment paid: ${errMsg(error)}`);
      } finally {
        setBusy(false);
      }
    },
    [payingSlot, commitmentId, services.commitments, load, toast],
  );

  const handleUnPay = (payment: CommitmentPayment) => setConfirmUnPay(payment);

  const doUnPay = async () => {
    if (!confirmUnPay) return;
    setBusy(true);
    try {
      await services.commitments.unPay(confirmUnPay.id);
      setConfirmUnPay(null);
      await load();
    } catch (error: unknown) {
      toast.show(`Could not un-pay payment: ${errMsg(error)}`);
      setConfirmUnPay(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    if (!commitment) return;
    setConfirmDelete(true);
  };

  const doDelete = async () => {
    if (!commitment) return;
    setBusy(true);
    try {
      await services.commitments.delete(commitmentId);
      setConfirmDelete(false);
      router.back(); // the tab refreshes on focus
    } catch (error: unknown) {
      toast.show(`Could not delete commitment: ${errMsg(error)}`);
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = () => {
    setBusy(true);
    services.commitments
      .unarchive(commitmentId)
      .then(() => load())
      .catch((error: unknown) => toast.show(`Could not restore commitment: ${errMsg(error)}`))
      .finally(() => setBusy(false));
  };

  const today = todayLocal();
  const archived = commitment !== null && commitment.archivedAt !== null;
  const canMarkPaid = commitment !== null && commitment.status === 'active' && !archived;

  // Compact schedule view: the summary + first N upcoming slots (expandable).
  const unpaid = schedule.filter((slot) => !paidByDate.has(slot.dueDate));
  const paidSlots = schedule.filter((slot) => paidByDate.has(slot.dueDate));
  const visibleUnpaid = showAllSchedule ? unpaid : unpaid.slice(0, UPCOMING_PREVIEW_COUNT);
  const hiddenUnpaid = unpaid.length - visibleUnpaid.length;
  const nextDue = unpaid[0]?.dueDate ?? null;
  /** Plan 018: the hero tints danger while the next payment is overdue. */
  const overdueNext = nextDue !== null && nextDue < today;

  if (loading) {
    return (
      <View style={styles.center}>
        <Card>
          <View style={{ gap: spacing.sm }}>
            <View style={{ height: 24, width: '55%', backgroundColor: colors.border, opacity: 0.55, borderRadius: 6 }} />
            <View style={{ height: 34, width: '40%', backgroundColor: colors.border, opacity: 0.55, borderRadius: 8 }} />
          </View>
        </Card>
      </View>
    );
  }

  if (loadError || !commitment) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>{loadError ?? 'Commitment not found'}</Text>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="commitment-detail-screen">
      {/* Header card (plan 018: tinted hero language — red when overdue, soft green otherwise) */}
      <Card tone={overdueNext && commitment.status === 'active' ? 'danger' : 'tint'} testID="commitment-hero">
        <View style={styles.titleRow}>
          <Ionicons
            name={(COMMITMENT_TYPE_ICONS[commitment.type as keyof typeof COMMITMENT_TYPE_ICONS] ?? 'calendar-outline') as never}
            size={20}
            color={colors.text}
          />
          <Text style={styles.name}>{commitment.name}</Text>
          {commitment.status !== 'cancelled' && !archived ? (
            <Button
              label="Edit"
              variant="secondary"
              icon="create-outline"
              onPress={() => router.push(`/commitments/${commitmentId}/edit` as never)}
              testID="commitment-edit"
            />
          ) : null}
          {!archived ? (
            <IconButton
              icon="trash-outline"
              tone="danger"
              filled
              label="Delete commitment"
              onPress={handleDelete}
              disabled={busy}
              testID="commitment-delete"
            />
          ) : null}
        </View>
        <View style={styles.badgeRow}>
          <Badge
            tone={commitment.status === 'cancelled' ? 'danger' : commitment.status === 'completed' ? 'accent' : 'neutral'}
            label={
              commitment.status === 'completed'
                ? 'Completed'
                : commitment.status === 'cancelled'
                  ? 'Cancelled'
                  : 'Active'
            }
          />
          {archived ? <Badge tone="warning" label="Archived" /> : null}
          <Text style={styles.typeLabel}>
            {COMMITMENT_TYPE_LABELS[commitment.type as keyof typeof COMMITMENT_TYPE_LABELS] ?? 'Other'}
            {commitment.frequency === 'one_time' ? ' · one-time' : ' · monthly'}
          </Text>
        </View>
        <Text
          style={styles.amount}
          numberOfLines={1}
          accessibilityLabel={`Payment amount, ${spokenMoneyLabel(commitment.paymentSen)}`}
        >
          {formatSen(commitment.paymentSen)}
        </Text>
        {commitment.totalSen !== null ? (
          <Text style={styles.remaining}>
            {formatSen(commitment.remainingSen)} of {formatSen(commitment.totalSen)} remaining
          </Text>
        ) : (
          <Text style={styles.remaining}>Recurring monthly</Text>
        )}
      </Card>

      {/* Schedule */}
      <Text style={styles.sectionTitle}>Schedule</Text>
      {schedule.length === 0 ? (
        <Text style={styles.sectionNote}>No payments in this window.</Text>
      ) : (
        <>
          {/* Compact payment-plan summary — one row replaces the wall of slots. */}
          <View style={styles.planCard} testID="commitment-plan-summary">
            <View style={styles.planLine}>
              <Ionicons
                name={commitment.frequency === 'one_time' ? 'calendar-outline' : 'repeat-outline'}
                size={16}
                color={colors.accent}
              />
              <Text style={styles.planCadence}>
                {commitment.frequency === 'one_time'
                  ? 'One-time payment'
                  : commitment.totalSen !== null
                    ? 'Monthly payment'
                    : 'Recurring monthly'}
              </Text>
              <Text style={styles.planAmount}>{formatSen(commitment.paymentSen)}</Text>
            </View>
            <Text style={styles.planNote}>
              {nextDue !== null
                ? `Next payment ${formatDayLabel(nextDue)} · ${unpaid.length} payment${unpaid.length === 1 ? '' : 's'} left`
                : 'All payments paid'}
              {commitment.totalSen !== null && nextDue !== null
                ? ` · ${formatSen(commitment.remainingSen)} remaining`
                : ''}
            </Text>
          </View>

          {visibleUnpaid.length > 0 ? (
            <>
              <Text style={styles.sectionSubtitle}>
                Upcoming{hiddenUnpaid > 0 ? ` · next ${UPCOMING_PREVIEW_COUNT} of ${unpaid.length}` : ''}
              </Text>
              {visibleUnpaid.map((slot) => (
                <ScheduleRow
                  key={slot.dueDate}
                  slot={slot}
                  payment={paidByDate.get(slot.dueDate)}
                  accountName={paidByDate.get(slot.dueDate) ? accountNameByPayment.get(paidByDate.get(slot.dueDate)!.id) : undefined}
                  overdue={slot.dueDate < today && !paidByDate.has(slot.dueDate)}
                  canMarkPaid={canMarkPaid}
                  busy={busy}
                  onMarkPaid={setPayingSlot}
                  onUnPay={handleUnPay}
                />
              ))}
              {hiddenUnpaid > 0 ? (
                <Pressable
                  onPress={() => setShowAllSchedule((v) => !v)}
                  style={({ pressed }) => [styles.showAllButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  testID="commitment-schedule-expand"
                >
                  <Ionicons name={showAllSchedule ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
                  <Text style={styles.showAllLabel}>
                    {showAllSchedule ? 'Show fewer' : `Show all ${unpaid.length} payments`}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {paidSlots.length > 0 ? (
            <>
              <Text style={styles.sectionSubtitle}>Paid history</Text>
              {paidSlots.map((slot) => (
                <ScheduleRow
                  key={slot.dueDate}
                  slot={slot}
                  payment={paidByDate.get(slot.dueDate)}
                  accountName={paidByDate.get(slot.dueDate) ? accountNameByPayment.get(paidByDate.get(slot.dueDate)!.id) : undefined}
                  overdue={slot.dueDate < today && !paidByDate.has(slot.dueDate)}
                  canMarkPaid={canMarkPaid}
                  busy={busy}
                  onMarkPaid={setPayingSlot}
                  onUnPay={handleUnPay}
                />
              ))}
            </>
          ) : null}
        </>
      )}
      {payments.length > 0 && schedule.length === 0 ? (
        <Text style={styles.sectionNote}>
          {payments.length} payment{payments.length === 1 ? '' : 's'} paid (outside this window).
        </Text>
      ) : null}

      {/* Status controls — Cancel is no longer shown (plan 016 follow-up); delete
          lives in the trash icon, edit in the header pill. */}
      {archived ? (
        <Button
          label="Restore commitment"
          variant="secondary"
          icon="refresh-outline"
          onPress={handleRestore}
          disabled={busy}
          testID="commitment-restore"
        />
      ) : null}

      <PaymentFlowSheet
        visible={payingSlot !== null}
        slot={payingSlot ?? { dueDate: '', amountSen: 0, index: 0 }}
        accounts={accounts}
        initialAccountId={
          lastUsedAccountId !== null && accounts.some((a) => a.id === lastUsedAccountId)
            ? lastUsedAccountId
            : accounts[0]?.id ?? null
        }
        busy={busy}
        onConfirm={handleMarkPaid}
        onCancel={() => setPayingSlot(null)}
      />

      <ConfirmSheet
        visible={confirmUnPay !== null}
        title="Un-pay payment"
        message="This removes the linked Debt/Repayment expense, restores the remaining amount, and reverses the balance change."
        confirmLabel="Un-pay"
        busy={busy}
        onConfirm={() => void doUnPay()}
        onCancel={() => setConfirmUnPay(null)}
      />

      <ConfirmSheet
        visible={confirmDelete}
        title={payments.length > 0 ? 'Archive commitment' : 'Delete commitment'}
        message={
          payments.length > 0
            ? 'This commitment has paid payments, so it will be ARCHIVED — every payment and linked expense stays, hidden from your lists. You can restore it anytime.'
            : 'This commitment has no payments — it will be deleted permanently.'
        }
        confirmLabel={payments.length > 0 ? 'Archive' : 'Delete'}
        busy={busy}
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </ScrollView>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  name: { fontSize: typography.title, fontWeight: '700', color: colors.text, flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md },
  typeLabel: { fontSize: typography.caption, color: colors.muted, fontWeight: '600', flexShrink: 1 },
  amount: {
    fontSize: typography.money,
    fontWeight: '800',
    color: colors.text,
    fontVariant: moneyFontVariant,
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  remaining: { fontSize: typography.body, color: colors.muted },
  sectionTitle: {
    fontSize: typography.emphasis,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionNote: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.md },
  sectionSubtitle: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  planCard: {
    flexDirection: 'column',
    backgroundColor: colors.accentSoft,
    borderRadius: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  planLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planCadence: { flex: 1, fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  planAmount: { fontSize: typography.emphasis, fontWeight: '800', color: colors.text, fontVariant: moneyFontVariant },
  planNote: { marginTop: spacing.xs, fontSize: typography.caption, color: colors.muted, fontWeight: '500' },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    marginTop: spacing.xs,
  },
  showAllLabel: { color: colors.accent, fontSize: typography.body, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});