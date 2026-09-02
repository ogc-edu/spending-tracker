/**
 * Plan 013 — ModelPicker: the discovered-model selector, or the manual model-ID
 * field shown when discovery failed but the key is valid (plan §Edge cases,
 * AI-8). No model ids are hardcoded anywhere — the list comes from discovery;
 * manual entry carries whatever the user types.
 */
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ModelInfo } from '@/ai/types';
import { colors, spacing, typography } from '@/theme';

export function ModelPicker({
  models,
  selected,
  onSelect,
  manual,
  manualValue,
  onManualChange,
}: {
  models: ModelInfo[];
  /** The persisted selection (highlighted when still discoverable). */
  selected: string | null;
  onSelect: (modelId: string) => void;
  /** Discovery failed → show the manual-ID entry instead of the list. */
  manual: boolean;
  manualValue: string;
  onManualChange: (text: string) => void;
}) {
  if (manual) {
    return (
      <View style={styles.block} testID="ai-model-manual">
        <Text style={styles.label}>Model ID (manual)</Text>
        <TextInput
          value={manualValue}
          onChangeText={onManualChange}
          placeholder="Enter a model ID"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="ai-model-manual-input"
        />
        <Text style={styles.note}>
          Discovery failed — enter the model ID manually (must be valid for the test to pass).
        </Text>
        <Pressable
          onPress={() => manualValue.trim() && onSelect(manualValue.trim())}
          disabled={!manualValue.trim()}
          style={({ pressed }) => [styles.useButton, pressed && !manualValue.trim() ? null : styles.pressed]}
          accessibilityRole="button"
          testID="ai-model-manual-use"
        >
          <Text style={styles.useButtonLabel}>Use this model</Text>
        </Pressable>
      </View>
    );
  }

  if (models.length === 0) {
    return (
      <View style={styles.block} testID="ai-model-empty">
        <Text style={styles.note}>Test the connection to discover available models.</Text>
      </View>
    );
  }

  return (
    <View style={styles.block} testID="ai-model-list">
      <Text style={styles.label}>Model</Text>
      {models.map((model) => {
        const active = model.id === selected;
        return (
          <Pressable
            key={model.id}
            onPress={() => onSelect(model.id)}
            style={({ pressed }) => [styles.modelRow, active && styles.modelRowActive, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            testID={`ai-model-option-${model.id}`}
          >
            <Ionicons
              name={active ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={active ? colors.accent : colors.muted}
            />
            <View style={styles.modelInfo}>
              <Text style={[styles.modelId, active && styles.modelIdActive]}>{model.id}</Text>
              {model.label && model.label !== model.id ? (
                <Text style={styles.modelLabel}>{model.label}</Text>
              ) : null}
            </View>
            {active ? <Text style={styles.activeTag}>Selected</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.lg },
  label: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.sm },
  note: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  useButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  useButtonLabel: { color: '#fff', fontSize: typography.emphasis, fontWeight: '600' },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  modelRowActive: { borderColor: colors.accent },
  modelInfo: { flex: 1 },
  modelId: { fontSize: typography.body, color: colors.text, fontWeight: '600' },
  modelIdActive: { color: colors.accent },
  modelLabel: { fontSize: typography.caption, color: colors.muted },
  activeTag: { fontSize: typography.caption, color: colors.accent, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});