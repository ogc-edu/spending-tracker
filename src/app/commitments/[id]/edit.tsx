/**
 * Edit commitment screen (plan 016 follow-up) — push screen at
 * /commitments/[id]/edit. Maps the row to CommitmentForm values (same
 * shape matrix as create: fixed ↔ total+start(+optional end); ongoing ↔
 * payment+start; one-time ↔ payment+due date), submits via service.update
 * (which recomputes remaining_sen from paid history), and returns to the
 * detail screen — every screen re-reads SQLite on focus (A4), so the
 * updated name/dates/amounts show immediately.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Commitment } from '@/db/schema';
import { CommitmentService } from '@/services/CommitmentService';
import {
  CommitmentForm,
  type CommitmentFormValues,
  type CommitmentKind,
} from '@/components/CommitmentForm';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { useToast } from '@/components/ToastProvider';
import { formatSenInput } from '@/utils/money';
import type { CommitmentInput } from '@/repositories/types';
import { geistWeights, useTheme } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Commitment row → form values (create-shape reverse). */
function commitmentToFormValues(commitment: Commitment): Partial<CommitmentFormValues> {
  const kind: CommitmentKind =
    commitment.frequency === 'one_time' ? 'one_time' : commitment.totalSen !== null ? 'fixed' : 'ongoing';
  return {
    name: commitment.name,
    type: commitment.type as CommitmentFormValues['type'],
    kind,
    total: commitment.totalSen !== null ? formatSenInput(commitment.totalSen) : '',
    payment: formatSenInput(commitment.paymentSen),
    startDate: commitment.startDate,
    endDate: commitment.endDate ?? '',
    dueDate: commitment.dueDate,
  };
}

export default function EditCommitmentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authService } = useAuth();
  const toast = useToast();
  const { colors } = useTheme();
  const commitmentId = Number(id);

  const service = useMemo(() => {
    const repos = repositories();
    return new CommitmentService(repos.commitments, authService);
  }, [authService]);

  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(commitmentId) || commitmentId <= 0) {
      setLoadError('Invalid commitment');
      setLoading(false);
      return;
    }
    try {
      const row = await service.byId(commitmentId);
      setCommitment(row);
      if (!row) setLoadError('Commitment not found');
    } catch (error: unknown) {
      setLoadError(errMsg(error));
    } finally {
      setLoading(false);
    }
  }, [service, commitmentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleSubmit = async (input: CommitmentInput) => {
    setSubmitting(true);
    try {
      await service.update(commitmentId, input);
      toast.show('Commitment saved');
      router.back();
    } catch (error: unknown) {
      toast.show(`Could not save changes: ${errMsg(error)}`);
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

  if (loadError || !commitment) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {loadError ?? 'Commitment not found'}
        </Text>
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

  return (
    <KeyboardScreen>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="edit-commitment-screen"
      >
        <CommitmentForm
          submitLabel="Save changes"
          onSubmit={handleSubmit}
          submitting={submitting}
          onCancel={() => router.back()}
          defaults={commitmentToFormValues(commitment)}
        />
      </ScrollView>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
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
    marginBottom: 16,
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
});