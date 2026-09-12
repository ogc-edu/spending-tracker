/**
 * New commitment screen (plan 008 / COM-1) — push screen at /commitments/new.
 * RHF + Zod CommitmentForm with the three shapes (fixed / ongoing / one-time);
 * on success the derived schedule exists implicitly (A3 — nothing else is
 * written; remaining_sen = total for fixed) and we return to the tab whose
 * list refreshes on focus (SQLite is the source of truth, A4).
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import { CommitmentService } from '@/services/CommitmentService';
import { CommitmentForm } from '@/components/CommitmentForm';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { useToast } from '@/components/ToastProvider';
import type { CommitmentInput } from '@/repositories/types';
import { colors, spacing, typography } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function NewCommitmentScreen() {
  const router = useRouter();
  const { authService } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const service = useMemo(() => {
    const repos = repositories();
    return new CommitmentService(repos.commitments, authService);
  }, [authService]);

  const handleSubmit = async (input: CommitmentInput) => {
    setSubmitting(true);
    try {
      await service.create(input);
      router.back();
    } catch (error: unknown) {
      toast.show(`Could not add commitment: ${errMsg(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardScreen>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="new-commitment-screen"
      >
        <CommitmentForm
          submitLabel="Add commitment"
          onSubmit={handleSubmit}
          submitting={submitting}
          onCancel={() => router.back()}
        />
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cancelLink, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.cancelLinkLabel}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardScreen>
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
  cancelLink: { alignItems: 'center', paddingVertical: spacing.lg },
  cancelLinkLabel: { color: colors.muted, fontSize: typography.body, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});