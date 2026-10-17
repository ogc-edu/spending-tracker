/**
 * Plan 013 — ModelPicker: the discovered-model selector, or the manual model-ID
 * field shown when discovery failed but the key is valid (plan §Edge cases,
 * AI-8). No model ids are hardcoded anywhere — the list comes from discovery;
 * manual entry carries whatever the user types.
 */
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ModelInfo } from '@/ai/types';
import { geistWeights, useTheme } from '@/theme';

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
  const { colors } = useTheme();

  if (manual) {
    return (
      <View style={styles.block} testID="ai-model-manual">
        <Text
          numberOfLines={1}
          style={[styles.label, { color: colors.textSecondary }]}
        >
          Model ID (manual)
        </Text>
        <TextInput
          value={manualValue}
          onChangeText={onManualChange}
          placeholder="Enter a model ID"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            {
              borderColor: colors.separator,
              backgroundColor: colors.fill,
              color: colors.text,
            },
          ]}
          testID="ai-model-manual-input"
        />
        <Text
          style={[styles.note, { color: colors.textTertiary }]}
        >
          Discovery failed — enter the model ID manually (must be valid for the test to pass).
        </Text>
        <TouchableOpacity
          onPress={() => manualValue.trim() && onSelect(manualValue.trim())}
          disabled={!manualValue.trim()}
          activeOpacity={0.7}
          style={[
            styles.useButton,
            {
              backgroundColor: colors.accent,
              opacity: !manualValue.trim() ? 0.4 : 1,
            },
          ]}
          accessibilityRole="button"
          testID="ai-model-manual-use"
        >
          <Text
            numberOfLines={1}
            style={[styles.useButtonLabel, { color: colors.onAccent }]}
          >
            Use this model
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (models.length === 0) {
    return (
      <View style={styles.block} testID="ai-model-empty">
        <Text
          style={[styles.note, { color: colors.textTertiary }]}
        >
          Test the connection to discover available models.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.block} testID="ai-model-list">
      <Text
        numberOfLines={1}
        style={[styles.label, { color: colors.textSecondary }]}
      >
        Model
      </Text>
      {models.map((m) => {
        const active = m.id === selected;
        return (
          <TouchableOpacity
            key={m.id}
            onPress={() => onSelect(m.id)}
            activeOpacity={0.7}
            style={[
              styles.modelRow,
              {
                borderColor: active ? colors.accent : colors.separator,
                backgroundColor: colors.fill,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            testID={`ai-model-option-${m.id}`}
          >
            <Ionicons
              name={active ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={active ? colors.accent : colors.textTertiary}
            />
            <View style={styles.modelInfo}>
              <Text
                numberOfLines={1}
                style={[
                  styles.modelId,
                  {
                    color: active ? colors.accent : colors.text,
                  },
                ]}
              >
                {m.id}
              </Text>
              {m.label && m.label !== m.id ? (
                <Text
                  numberOfLines={1}
                  style={[styles.modelLabel, { color: colors.textTertiary }]}
                >
                  {m.label}
                </Text>
              ) : null}
            </View>
            {active ? (
              <Text
                numberOfLines={1}
                style={[styles.activeTag, { color: colors.accent }]}
              >
                Selected
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 4,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: geistWeights.medium,
    marginBottom: 6,
  },
  note: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.regular,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    minHeight: 44,
    marginBottom: 8,
    fontFamily: geistWeights.regular,
  },
  useButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  useButtonLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 6,
  },
  modelInfo: {
    flex: 1,
  },
  modelId: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  modelLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.regular,
    marginTop: 1,
  },
  activeTag: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
});