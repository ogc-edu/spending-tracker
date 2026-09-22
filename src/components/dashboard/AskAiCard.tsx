/**
 * AskAiCard (plan 019) — the Dashboard's "Ask about your money" surface.
 *
 * Replaces the plan-015 fixed "Explain my allowance" button: the user can type
 * a free-form question about their current numbers, or tap one of the common
 * prompts to submit it in one tap. The shared `AIAnalysisCard` renders below
 * (pending / typed error + Retry / validated result) — this component only
 * owns the input text and presentational chrome.
 *
 * The question is capped at MAX_QUESTION_CHARS (the same cap the facade
 * enforces); the fixed system instruction is never built from it (plan 019).
 */
import { useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAX_QUESTION_CHARS } from '@/ai/types';
import { AIAnalysisCard, type AIAnalysisState } from '@/components/AIAnalysisCard';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useKeyboardAwareFocus } from '@/components/KeyboardAwareScrollView';
import { colors, radius, spacing, typography } from '@/theme';

/** The prebuilt prompts shown as one-tap chips. Order = usefulness order. */
export const ASK_SUGGESTIONS = [
  'Explain my allowance',
  'How much can I spend this month?',
  'Explain my next month commitment',
  'Where is most of my money going?',
  'Am I on track this month?',
] as const;

export interface AskAiCardProps {
  /** The shared result surface state (pending / error / result / onRetry). */
  ai: AIAnalysisState;
  /** The question the current result/error belongs to (a small header). */
  label?: string | null;
  /** Submit a trimmed, non-empty question. */
  onSubmit(question: string): void;
  /** Disable the whole surface (e.g. no snapshot yet). */
  disabled?: boolean;
}

/** Keep a pasted (up to MAX_QUESTION_CHARS) question from wrapping the whole card. */
const LABEL_MAX_CHARS = 90;

function displayLabel(label: string | null): string | null {
  if (!label) return null;
  return label.length > LABEL_MAX_CHARS ? `${label.slice(0, LABEL_MAX_CHARS - 1)}…` : label;
}

export function AskAiCard({ ai, label = null, onSubmit, disabled = false }: AskAiCardProps) {
  const [text, setText] = useState('');
  const revealInput = useKeyboardAwareFocus();

  const canSend = text.trim().length > 0 && !ai.pending && !disabled;

  const submit = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || ai.pending || disabled) return;
    setText('');
    Keyboard.dismiss();
    onSubmit(trimmed);
  };

  return (
    <Card testID="ask-ai-card">
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="sparkles" size={17} color={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Ask about your money</Text>
          <Text style={styles.subtitle}>Answers use your current numbers only.</Text>
        </View>
      </View>

      {/* One-tap common prompts. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chipRow}
        testID="ask-ai-suggestions"
      >
        {ASK_SUGGESTIONS.map((suggestion, index) => (
          <Chip
            key={suggestion}
            label={suggestion}
            disabled={ai.pending || disabled}
            onPress={() => submit(suggestion)}
            testID={`ask-ai-suggestion-${index}`}
          />
        ))}
      </ScrollView>

      {/* The question input + send action. */}
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={revealInput}
          onSubmitEditing={() => submit(text)}
          placeholder="Ask a question about your money…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          maxLength={MAX_QUESTION_CHARS}
          returnKeyType="send"
          editable={!disabled}
          accessibilityLabel="Ask a question about your money"
          testID="ask-ai-input"
        />
        <Pressable
          onPress={() => submit(text)}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send question"
          accessibilityState={{ disabled: !canSend, busy: ai.pending }}
          style={({ pressed }) => [
            styles.sendButton,
            !canSend && styles.sendDisabled,
            pressed && canSend && styles.pressed,
          ]}
          testID="ask-ai-send"
        >
          {ai.pending ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Ionicons name="arrow-up" size={20} color={colors.onAccent} />
          )}
        </Pressable>
      </View>

      {/* Shared result surface — renders nothing until a question is asked. */}
      <AIAnalysisCard label={displayLabel(label)} {...ai} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontSize: typography.emphasis, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  subtitle: { fontSize: typography.caption, color: colors.muted, marginTop: 2 },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
