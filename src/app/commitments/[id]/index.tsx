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
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Commitment, CommitmentPayment, Expense } from '@/db/schema';
import { CommitmentService } from '@/services/CommitmentService';
import { AccountService } from '@/services/AccountService';
import type { ScheduledPayment } from '@/engine/commitments';
import { useUiStore } from '@/store/uiStore';
import { todayLocal } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';
import { COMMITMENT_TYPE_ICONS, COMMITMENT_TYPE_LABELS } from '@/components/commitmentMeta';
import { ScheduleRow } from '@/components/ScheduleRow';
import { PaymentFlowSheet } from '@/components/PaymentFlowSheet';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function CommitmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authService } = useAuth();
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
        await load();
      } catch (error: unknown) {
        Alert.alert('Mark payment paid', errMsg(error));
      } finally {
        setBusy(false);
      }
    },
    [payingSlot, commitmentId, services.commitments, load],
  );

  const handleUnPay = (payment: CommitmentPayment) => {
    Alert.alert(
      'Un-pay payment',
      'This removes the linked Debt/Repayment expense, restores the remaining amount, and reverses the balance change.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Un-pay',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await services.commitments.unPay(payment.id);
              await load();
            } catch (error: unknown) {
              Alert.alert('Un-pay payment', errMsg(error));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleCancel = () => {
    if (!commitment) return;
    Alert.alert(
      'Cancel commitment',
      'Cancel is permanent — re-create the commitment instead of re-activating. Paid history is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cancel commitment',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await services.commitments.cancel(commitmentId);
              await load();
            } catch (error: unknown) {
              Alert.alert('Cancel commitment', errMsg(error));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!commitment) return;
    const hasPayments = payments.length > 0;
    Alert.alert(
      hasPayments ? 'Archive commitment' : 'Delete commitment',
      hasPayments
        ? 'This commitment has paid payments, so it will be ARCHIVED — every payment and linked expense stays, hidden from your lists. You can restore it anytime.'
        : 'This commitment has no payments — it will be deleted permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hasPayments ? 'Archive' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await services.commitments.delete(commitmentId);
              router.back(); // the tab refreshes on focus
            } catch (error: unknown) {
              Alert.alert('Delete commitment', errMsg(error));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleRestore = () => {
    setBusy(true);
    services.commitments
      .unarchive(commitmentId)
      .then(() => load())
      .catch((error: unknown) => Alert.alert('Restore commitment', errMsg(error)))
      .finally(() => setBusy(false));
  };

  const today = todayLocal();
  const archived = commitment !== null && commitment.archivedAt !== null;
  const canMarkPaid = commitment !== null && commitment.status === 'active' && !archived;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (loadError || !commitment) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>{loadError ?? 'Commitment not found'}</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => (pressed ? [styles.button, styles.pressed] : styles.button)}
          accessibilityRole="button"
        >
          <Text style={styles.buttonLabel}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="commitment-detail-screen">
      {/* Header card */}
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Ionicons
            name={(COMMITMENT_TYPE_ICONS[commitment.type as keyof typeof COMMITMENT_TYPE_ICONS] ?? 'calendar-outline') as never}
            size={20}
            color={colors.text}
          />
          <Text style={styles.name}>{commitment.name}</Text>
        </View>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, commitment.status === 'cancelled' && styles.badgeDanger]}>
            <Text style={[styles.badgeLabel, commitment.status === 'cancelled' && styles.badgeLabelDanger]}>
              {commitment.status === 'completed' ? 'Completed' : commitment.status === 'cancelled' ? 'Cancelled' : 'Active'}
            </Text>
          </View>
          {archived ? (
            <View style={[styles.badge, styles.badgeArchived]}>
              <Text style={styles.badgeLabelArchived}>Archived</Text>
            </View>
          ) : null}
          <Text style={styles.typeLabel}>
            {COMMITMENT_TYPE_LABELS[commitment.type as keyof typeof COMMITMENT_TYPE_LABELS] ?? 'Other'}
            {commitment.frequency === 'one_time' ? ' · one-time' : ' · monthly'}
          </Text>
        </View>
        <Text style={styles.amount}>{formatSen(commitment.paymentSen)}</Text>
        {commitment.totalSen !== null ? (
          <Text style={styles.remaining}>
            {formatSen(commitment.remainingSen)} of {formatSen(commitment.totalSen)} remaining
          </Text>
        ) : (
          <Text style={styles.remaining}>Recurring monthly</Text>
        )}
      </View>

      {/* Schedule */}
      <Text style={styles.sectionTitle}>Schedule</Text>
      {schedule.length === 0 ? (
        <Text style={styles.sectionNote}>No payments in this window.</Text>
      ) : (
        schedule.map((slot) => (
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
        ))
      )}
      {payments.length > 0 && schedule.length === 0 ? (
        <Text style={styles.sectionNote}>
          {payments.length} payment{payments.length === 1 ? '' : 's'} paid (outside this window).
        </Text>
      ) : null}

      {/* Status controls */}
      {archived ? (
        <Pressable
          onPress={handleRestore}
          style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="commitment-restore"
        >
          <Ionicons name="refresh-outline" size={18} color={colors.accent} />
          <Text style={styles.restoreLabel}>Restore commitment</Text>
        </Pressable>
      ) : null}

      {commitment.status === 'active' && !archived ? (
        <Pressable
          onPress={handleCancel}
          disabled={busy}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="commitment-cancel"
        >
          <Ionicons name="close-circle-outline" size={18} color={colors.warning} />
          <Text style={styles.cancelLabel}>Cancel commitment</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={handleDelete}
        disabled={busy}
        style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        accessibilityRole="button"
        testID="commitment-delete"
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <Text style={styles.deleteLabel}>
          {payments.length > 0 && !archived ? 'Archive commitment' : 'Delete commitment'}
        </Text>
      </Pressable>

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
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  buttonLabel: { color: colors.text, fontSize: typography.emphasis, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  name: { fontSize: typography.title, fontWeight: '700', color: colors.text, flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md },
  badge: {
    backgroundColor: colors.accentSoft,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeDanger: { backgroundColor: colors.dangerSoft },
  badgeArchived: { backgroundColor: colors.warningSoft },
  badgeLabel: { fontSize: typography.caption, fontWeight: '700', color: colors.accent },
  badgeLabelDanger: { color: colors.danger },
  badgeLabelArchived: { color: colors.warning },
  typeLabel: { fontSize: typography.caption, color: colors.muted, fontWeight: '600', flexShrink: 1 },
  amount: {
    fontSize: typography.money,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    marginBottom: spacing.xs,
  },
  remaining: { fontSize: typography.body, color: colors.muted },
  sectionTitle: {
    fontSize: typography.emphasis,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionNote: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.md },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.accentSoft,
  },
  restoreLabel: { color: colors.accent, fontSize: typography.emphasis, fontWeight: '700' },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.warningSoft,
  },
  cancelLabel: { color: colors.warning, fontSize: typography.emphasis, fontWeight: '700' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.dangerSoft,
  },
  deleteLabel: { color: colors.danger, fontSize: typography.emphasis, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});