import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MAX_QUESTION_CHARS } from '@/ai/types';
import { AIAnalysisCard, type AIAnalysisState } from '@/components/AIAnalysisCard';
import { Chip } from '@/components/ui/Chip';
import { Glyph } from '@/components/ui/Glyph';
import { Sheet } from '@/components/ui/Sheet';
import { geistWeights, useTheme } from '@/theme';

export const ASK_SUGGESTIONS = [
  'What do I need to pay by the end of this month?',
  'Explain my next month commitment',
  'Where is most of my money going?',
  'How does my spending compare to what is due?',
] as const;

export interface AskAiSheetProps {
  visible: boolean;
  onClose: () => void;
  ai: AIAnalysisState;
  label?: string | null;
  onSubmit: (question: string) => void;
  disabled?: boolean;
}

const LABEL_MAX_CHARS = 90;

function displayLabel(label: string | null): string | null {
  if (!label) return null;
  return label.length > LABEL_MAX_CHARS ? `${label.slice(0, LABEL_MAX_CHARS - 1)}…` : label;
}

export function AskAiSheet({
  visible,
  onClose,
  ai,
  label = null,
  onSubmit,
  disabled = false,
}: AskAiSheetProps) {
  const { colors } = useTheme();
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0 && !ai.pending && !disabled;

  const submit = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || ai.pending || disabled) return;
    setText('');
    Keyboard.dismiss();
    onSubmit(trimmed);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Ask about your money"
      titleTestID="ask-ai-sheet-title"
      cardTestID="ask-ai-sheet"
    >
      <View testID="ai-daily-insight" style={styles.container}>
        <View testID="ask-ai-card">
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: colors.textSecondary }]}
          >
            Answers use your current numbers only.
          </Text>

          {/* Suggestions row */}
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

          {/* Input row */}
          <View
            style={[
              styles.inputRow,
              {
                backgroundColor: colors.fill,
                borderColor: colors.separator,
              },
            ]}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => submit(text)}
              placeholder="Ask a question about your money…"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  color: colors.text,
                },
              ]}
              maxLength={MAX_QUESTION_CHARS}
              returnKeyType="send"
              editable={!disabled}
              accessibilityLabel="Ask a question about your money"
              testID="ask-ai-input"
            />
            <TouchableOpacity
              onPress={() => submit(text)}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send question"
              accessibilityState={{ disabled: !canSend, busy: ai.pending }}
              activeOpacity={0.8}
              style={[
                styles.sendButton,
                {
                  backgroundColor: canSend ? colors.accent : colors.fillStrong,
                },
              ]}
              testID="ask-ai-send"
            >
              {ai.pending ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Glyph
                  name="chevron"
                  size={18}
                  color={canSend ? colors.onAccent : colors.textTertiary}
                  strokeWidth={2.2}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Shared AI Analysis Result */}
          <AIAnalysisCard label={displayLabel(label)} {...ai} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.medium,
    fontWeight: '500',
    marginBottom: 4,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 6,
    minHeight: 48,
    marginTop: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: geistWeights.medium,
    paddingVertical: 10,
    paddingRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
