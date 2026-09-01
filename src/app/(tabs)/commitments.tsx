/**
 * Commitments tab (plan 008 / COM-1..4) — the active commitments list.
 *
 * Per row: semantic type icon, name, next due (first UNPAID slot), an
 * OVERDUE badge in danger color when that slot is in the past (never hidden —
 * overdue stays visible), a status badge (completed / cancelled), and
 * paid/total progress like "2/6" for fixed schedules (paid count only for
 * ongoing, which has no cap).
 *
 * Derived values come from the pure engine over service-fetched rows (the
 * budgets-screen pattern — no SQL, no money math here). The list re-reads
 * SQLite on focus (A4) so mark-paid/cancel/archive elsewhere appears on
 * return. Archived commitments (C1) live in their own bottom section with a
 * Restore action — hidden from the main list, never deleted data.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Commitment, CommitmentPayment } from '@/db/schema';
import { CommitmentService } from '@/services/CommitmentService';
import { commitmentSchedule, type CommitmentLike, type ScheduledPayment } from '@/engine/commitments';
import { addMonthsClamped, formatDayLabel, todayLocal } from '@/utils/dates';
import { colors, spacing, typography } from '@/theme';
import { COMMITMENT_TYPE_ICONS } from '@/components/commitmentMeta';
import { categoryColor } from '@/components/categoryMeta';
import { EmptyState } from '@/components/EmptyState';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Progress "2/6" for bounded schedules; free-form paid count for ongoing. */
function progressLabel(commitment: Commitment, paid: CommitmentPayment[], slots: ScheduledPayment[]): string {
  if (commitment.totalSen !== null) {
    return `${paid.length}/${slots.length}`;
  }
  return `${paid.length} paid`;
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
  const { authService } = useAuth();

  const service = useMemo(() => {
    const repos = repositories();
    return new CommitmentService(repos.commitments, authService);
  }, [authService]);

  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [archived, setArchived] = useState<Commitment[]>([]);
  const [payments, setPayments] = useState<CommitmentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rows, arch, paid] = await Promise.all([
        service.list(),
        service.listArchived(),
        service.allPaidPayments(),
      ]);
      setCommitments(rows);
      setArchived(arch);
      setPayments(paid);
      setError(null);
    } catch (loadError: unknown) {
      setError(errMsg(loadError));
    } finally {
      setLoading(false);
    }
  }, [service]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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

  const handleRestore = (commitment: Commitment) => {
    setBusy(true);
    service
      .unarchive(commitment.id)
      .then(() => load())
      .catch((restoreError: unknown) => Alert.alert('Commitments', errMsg(restoreError)))
      .finally(() => setBusy(false));
  };

  const today = todayLocal();

  const renderRow = (commitment: Commitment) => {
    const due = nextDue(commitment);
    const overdue = due !== null && due < today;
    const slots = scheduleFor(commitment);
    const paid = payments.filter((p) => p.commitmentId === commitment.id);
    const progress = progressLabel(commitment, paid, slots);
    return (
      <Pressable
        key={commitment.id}
        onPress={() => router.push(`/commitments/${commitment.id}` as never)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        testID={`commitment-row-${commitment.id}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${categoryColor(commitment.id)}22` }]}>
          <Ionicons
            name={(COMMITMENT_TYPE_ICONS[commitment.type as keyof typeof COMMITMENT_TYPE_ICONS] ?? 'calendar-outline') as never}
            size={20}
            color={categoryColor(commitment.id)}
          />
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {commitment.name}
          </Text>
          <View style={styles.metaLine}>
            {due !== null ? (
              <Text
                style={[styles.dueText, overdue && styles.overdueText]}
                testID={`commitment-next-due-${commitment.id}`}
              >
                {overdue ? 'Overdue · ' : 'Next due · '}
                {formatDayLabel(due)}
              </Text>
            ) : (
              <Text style={styles.dueText}>All paid</Text>
            )}
            <Text style={styles.progress}>{progress}</Text>
          </View>
        </View>
        {commitment.status !== 'active' ? (
          <View style={[styles.statusBadge, commitment.status === 'cancelled' && styles.statusCancelled]}>
            <Text style={styles.statusLabel}>{commitment.status === 'completed' ? 'Done' : 'Cancelled'}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container} testID="commitments-screen">
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {commitments.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No commitments"
              body="Debts, bills, rent and installments — mark payments paid as they happen."
              testID="commitments-empty"
            />
          ) : (
            commitments.map(renderRow)
          )}

          {archived.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Archived</Text>
              <Text style={styles.sectionNote}>
                Kept for history — restore anytime (payments and expenses stay intact).
              </Text>
              {archived.map((commitment) => (
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

          <View style={styles.spacer} />
        </ScrollView>
      )}

      <Pressable
        onPress={() => router.push('/commitments/new' as never)}
        style={({ pressed }) => (pressed ? [styles.fab, styles.fabPressed] : styles.fab)}
        accessibilityRole="button"
        accessibilityLabel="Add commitment"
        testID="add-commitment-fab"
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },
  errorText: {
    fontSize: typography.body,
    color: colors.danger,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  centerBox: { alignItems: 'center', paddingTop: spacing.xxl * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    padding: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  name: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  dueText: { fontSize: typography.caption, color: colors.muted, fontWeight: '600', flexShrink: 1 },
  overdueText: { color: colors.danger, fontWeight: '700' },
  progress: { fontSize: typography.caption, color: colors.muted },
  statusBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusCancelled: { backgroundColor: colors.dangerSoft },
  statusLabel: { fontSize: typography.caption, fontWeight: '700', color: colors.accent },
  sectionTitle: {
    fontSize: typography.emphasis,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionNote: {
    fontSize: typography.caption,
    color: colors.muted,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    padding: spacing.md,
  },
  archivedName: { flex: 1, color: colors.muted },
  restoreButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  restoreLabel: { color: colors.accent, fontSize: typography.caption, fontWeight: '700' },
  spacer: { height: spacing.lg },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabPressed: { opacity: 0.85 },
  pressed: { opacity: 0.7 },
});