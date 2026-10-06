/**
 * AskAiCard (plan 019, redesigned Plan 003) — The Contextual AI Daily Insight card:
 * The Dashboard's "Ask about your money" surface powered by on-device BYOK prompts
 * and free-form money inquiries.
 *
 * Plan 003 Bento redesign:
 * - Retains testID="ai-daily-insight", ask-ai-card, ask-ai-input, ask-ai-send, ask-ai-suggestions.
 * - BentoCard obsidian luxe container with cyber cyan / accent accents.
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
import { BentoCard } from '@/components/ui/BentoCard';
import { Chip } from '@/components/ui/Chip';
import { useKeyboardAwareFocus } from '@/components/KeyboardAwareScrollView';
import { colors, radius, spacing, typography } from '@/theme';
import { cn } from '@/lib/utils';

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
    <View testID="ai-daily-insight">
      <BentoCard testID="ask-ai-card" className="p-5 border border-border/60 bg-card mb-4">
        {/* Header */}
        <View style={styles.header} className="flex-row items-center gap-2.5 mb-3">
          <View
            style={styles.iconBadge}
            className="w-8 h-8 rounded-full bg-accent/15 items-center justify-center border border-accent/20"
          >
            <Ionicons name="sparkles" size={16} color={colors.accent} />
          </View>
          <View style={styles.headerText} className="flex-1">
            <Text className="text-base font-bold text-foreground" style={styles.title}>
              Ask about your money
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5" style={styles.subtitle}>
              Answers use your current numbers only.
            </Text>
          </View>
        </View>

        {/* One-tap prompt suggestion chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chipRow}
          testID="ask-ai-suggestions"
          className="mb-1"
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

        {/* Question input + send action */}
        <View
          className="flex-row items-center gap-2 mt-2.5 border border-border/60 rounded-xl bg-muted/20 pl-3 pr-1 py-1 min-h-[48px]"
          style={styles.inputRow}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            onFocus={revealInput}
            onSubmitEditing={() => submit(text)}
            placeholder="Ask a question about your money…"
            placeholderTextColor={colors.muted}
            className="flex-1 text-sm text-foreground py-2 pr-1"
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
            className={cn(
              'w-10 h-10 rounded-full bg-primary items-center justify-center',
              !canSend && 'opacity-40'
            )}
            style={({ pressed }) => [
              styles.sendButton,
              !canSend && styles.sendDisabled,
              pressed && canSend && styles.pressed,
            ]}
            testID="ask-ai-send"
          >
            {ai.pending ? (
              <ActivityIndicator size="small" color="#090B10" />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#090B10" />
            )}
          </Pressable>
        </View>

        {/* Shared AI Analysis Result */}
        <AIAnalysisCard label={displayLabel(label)} {...ai} />
      </BentoCard>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
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
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
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
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
