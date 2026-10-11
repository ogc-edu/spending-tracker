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
import { geistWeights, useTheme } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function NewCommitmentScreen() {
  const router = useRouter();
  const { authService } = useAuth();
  const toast = useToast();
  const { colors } = useTheme();
  const [submitting, setSubmitting] = useState(false);

  const service = useMemo(() => {
    const repos = repositories();
    return new CommitmentService(repos.commitments, authService);
  }, [authService]);

  const handleSubmit = async (input: CommitmentInput) => {
    setSubmitting(true);
    try {
      await service.create(input);
      toast.show('Commitment added');
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
        style={[styles.container, { backgroundColor: colors.bg }]}
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
          <Text style={[styles.cancelLinkLabel, { color: colors.textSecondary }]}>
            Cancel
          </Text>
        </Pressable>
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
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelLinkLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  pressed: {
    opacity: 0.6,
  },
});