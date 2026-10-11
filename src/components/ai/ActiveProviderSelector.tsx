/**
 * Plan 013 — ActiveProviderSelector: the "Active AI Provider" picker.
 * Options are CONFIGURED providers only; nothing configured renders the
 * "No AI provider configured" empty state. No automatic fallback — the user
 * picks the active provider explicitly, one tap to switch.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AIProviderName } from '@/ai/types';
import type { ConfigurableAIProvider } from '@/services/AiConfigService';
import { geistWeights, useTheme } from '@/theme';
import { PROVIDER_ICONS, PROVIDER_LABELS } from './providerMeta';

export function ActiveProviderSelector({
  configured,
  active,
  onSelect,
}: {
  configured: ConfigurableAIProvider[];
  active: AIProviderName | null;
  onSelect: (provider: ConfigurableAIProvider) => void;
}) {
  const { colors } = useTheme();

  if (configured.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          {
            backgroundColor: colors.surface,
            borderColor: colors.separator,
          },
        ]}
        testID="ai-active-selector-empty"
      >
        <Ionicons name="sparkles-outline" size={18} color={colors.textTertiary} />
        <View style={styles.emptyInfo}>
          <Text
            numberOfLines={1}
            style={[styles.emptyTitle, { color: colors.text }]}
          >
            No AI provider configured
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.emptyNote, { color: colors.textSecondary }]}
          >
            Configure Gemini or DeepSeek to enable AI analysis.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.block} testID="ai-active-selector">
      {configured.map((provider) => {
        const isActive = active === provider;
        return (
          <Pressable
            key={provider}
            onPress={() => onSelect(provider)}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: colors.surface,
                borderColor: isActive ? colors.accent : colors.separator,
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            testID={`ai-active-option-${provider}`}
          >
            <Ionicons
              name={PROVIDER_ICONS[provider]}
              size={18}
              color={isActive ? colors.accent : colors.textTertiary}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.optionLabel,
                {
                  color: isActive ? colors.accent : colors.text,
                },
              ]}
            >
              {PROVIDER_LABELS[provider]}
            </Text>
            {isActive ? (
              <View
                style={[
                  styles.activeTag,
                  {
                    backgroundColor: colors.fillStrong,
                    borderColor: colors.accent,
                  },
                ]}
                testID={`ai-active-tag-${provider}`}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.activeTagLabel, { color: colors.accent }]}
                >
                  Active
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 16,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  emptyInfo: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  emptyNote: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.regular,
    marginTop: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  activeTag: {
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  activeTagLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
  },
  pressed: {
    opacity: 0.7,
  },
});