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
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';
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
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authService } = useAuth();
  const toast = useToast();
  const { colors } = useTheme();
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

  const [confirmUnPay, setConfirmUnPay] = useState<CommitmentPayment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      router.back();
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

  const unpaid = schedule.filter((slot) => !paidByDate.has(slot.dueDate));
  const paidSlots = schedule.filter((slot) => paidByDate.has(slot.dueDate));
  const visibleUnpaid = showAllSchedule ? unpaid : unpaid.slice(0, UPCOMING_PREVIEW_COUNT);
  const hiddenUnpaid = unpaid.length - visibleUnpaid.length;
  const nextDue = unpaid[0]?.dueDate ?? null;
  const overdueNext = nextDue !== null && nextDue < today;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (loadError || !commitment) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{loadError ?? 'Commitment not found'}</Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.backLink}
          accessibilityRole="button"
        >
          <Text style={[styles.backLinkLabel, { color: colors.link }]}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const payoffPercent =
    commitment.totalSen !== null && commitment.totalSen > 0
      ? Math.max(0, Math.min(100, ((commitment.totalSen - commitment.remainingSen) / commitment.totalSen) * 100))
      : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
      testID="commitment-detail-screen"
    >
      {/* Header card / Hero */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surface,
            borderColor: overdueNext && commitment.status === 'active' ? colors.danger : colors.separator,
          },
        ]}
        testID="commitment-hero"
      >
        <View style={styles.titleRow}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: overdueNext && commitment.status === 'active' ? colors.fillStrong : colors.fill,
              },
            ]}
          >
            <Ionicons
              name={(COMMITMENT_TYPE_ICONS[commitment.type as keyof typeof COMMITMENT_TYPE_ICONS] ?? 'calendar-outline') as never}
              size={20}
              color={overdueNext && commitment.status === 'active' ? colors.danger : colors.accent}
            />
          </View>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: colors.text }]}
          >
            {commitment.name}
          </Text>
          {commitment.status !== 'cancelled' && !archived ? (
            <Pressable
              onPress={() => router.push(`/commitments/${commitmentId}/edit` as never)}
              style={({ pressed }) => [
                styles.editPill,
                { backgroundColor: colors.fillStrong },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Edit commitment"
              testID="commitment-edit"
            >
              <Text style={[styles.editPillText, { color: colors.text }]}>Edit</Text>
            </Pressable>
          ) : null}
          {!archived ? (
            <Pressable
              onPress={handleDelete}
              disabled={busy}
              style={({ pressed }) => [
                styles.deleteBtn,
                { backgroundColor: colors.fillStrong },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Delete commitment"
              testID="commitment-delete"
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.badgeRow}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor:
                  commitment.status === 'completed'
                    ? colors.fillStrong
                    : overdueNext && commitment.status === 'active'
                      ? colors.fillStrong
                      : colors.fillStrong,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    commitment.status === 'completed'
                      ? colors.accent
                      : commitment.status === 'cancelled'
                        ? colors.textTertiary
                        : overdueNext && commitment.status === 'active'
                          ? colors.danger
                          : colors.accent,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    overdueNext && commitment.status === 'active'
                      ? colors.danger
                      : colors.text,
                },
              ]}
            >
              {commitment.status === 'completed'
                ? 'Completed'
                : commitment.status === 'cancelled'
                  ? 'Cancelled'
                  : overdueNext && commitment.status === 'active'
                    ? 'Overdue'
                    : 'Active'}
            </Text>
          </View>

          {archived ? (
            <View style={[styles.statusPill, { backgroundColor: colors.fillStrong }]}>
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>Archived</Text>
            </View>
          ) : null}

          <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>
            {COMMITMENT_TYPE_LABELS[commitment.type as keyof typeof COMMITMENT_TYPE_LABELS] ?? 'Other'}
            {commitment.frequency === 'one_time' ? ' · one-time' : ' · monthly'}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.separator }]} />

        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[styles.amountHero, { color: colors.text }]}
          accessibilityLabel={`Payment amount, ${spokenMoneyLabel(commitment.paymentSen)}`}
        >
          {formatSen(commitment.paymentSen)}
        </Text>

        {commitment.totalSen !== null ? (
          <>
            <View style={[styles.progressTrack, { backgroundColor: colors.track }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.accent,
                    width: `${payoffPercent}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.remaining, { color: colors.textSecondary }]}>
              {formatSen(commitment.remainingSen)} of {formatSen(commitment.totalSen)} remaining
            </Text>
          </>
        ) : commitment.frequency === 'monthly' ? (
          <Text style={[styles.remaining, { color: colors.textSecondary }]}>
            Recurring monthly · {nextDue !== null ? `${overdueNext ? 'Overdue' : 'Next due'} ${formatDayLabel(nextDue)}` : 'All paid'}
          </Text>
        ) : (
          <Text style={[styles.remaining, { color: colors.textSecondary }]}>
            {nextDue !== null ? `${overdueNext ? 'Overdue' : 'Maturity date'} ${formatDayLabel(nextDue)}` : 'Settled'}
          </Text>
        )}
      </View>

      {/* Schedule Section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Schedule</Text>
      {schedule.length === 0 ? (
        <Text style={[styles.sectionNote, { color: colors.textTertiary }]}>
          No payments in this window.
        </Text>
      ) : (
        <>
          {/* Summary Plan Card */}
          <View
            style={[
              styles.planCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.separator,
              },
            ]}
            testID="commitment-plan-summary"
          >
            <View style={styles.planLine}>
              <Ionicons
                name={commitment.frequency === 'one_time' ? 'calendar-outline' : 'repeat-outline'}
                size={16}
                color={colors.accent}
              />
              <Text
                numberOfLines={1}
                style={[styles.planCadence, { color: colors.text }]}
              >
                {commitment.frequency === 'one_time'
                  ? 'One-time payment'
                  : commitment.totalSen !== null
                    ? 'Monthly payment'
                    : 'Recurring monthly'}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.planAmount, { color: colors.text }]}
              >
                {formatSen(commitment.paymentSen)}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.planNote, { color: colors.textSecondary }]}
            >
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
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
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
                  <Ionicons name={showAllSchedule ? 'chevron-up' : 'chevron-down'} size={16} color={colors.link} />
                  <Text style={[styles.showAllLabel, { color: colors.link }]}>
                    {showAllSchedule ? 'Show fewer' : `Show all ${unpaid.length} payments`}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {paidSlots.length > 0 ? (
            <>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Paid history
              </Text>
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
        <Text style={[styles.sectionNote, { color: colors.textTertiary }]}>
          {payments.length} payment{payments.length === 1 ? '' : 's'} paid (outside this window).
        </Text>
      ) : null}

      {/* Restore control for archived */}
      {archived ? (
        <Pressable
          onPress={handleRestore}
          disabled={busy}
          style={({ pressed }) => [
            styles.restoreBtn,
            { backgroundColor: colors.fillStrong },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          testID="commitment-restore"
        >
          <Ionicons name="refresh-outline" size={16} color={colors.text} />
          <Text style={[styles.restoreBtnText, { color: colors.text }]}>
            Restore commitment
          </Text>
        </Pressable>
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
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    marginBottom: 8,
  },
  backLink: {
    padding: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  backLinkLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    flex: 1,
  },
  editPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPillText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  typeLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  amountHero: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    fontVariant: tabularNumsVariant,
    marginBottom: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 6,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  remaining: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    marginBottom: 10,
  },
  sectionNote: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
  },
  planCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 4,
  },
  planLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planCadence: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  planAmount: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    fontVariant: tabularNumsVariant,
  },
  planNote: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
    marginTop: 4,
  },
  showAllLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    marginTop: 16,
  },
  restoreBtnText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  pressed: {
    opacity: 0.7,
  },
});