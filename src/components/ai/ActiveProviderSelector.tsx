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
import { colors, spacing, typography } from '@/theme';
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
  if (configured.length === 0) {
    return (
      <View style={styles.empty} testID="ai-active-selector-empty">
        <Ionicons name="sparkles-outline" size={18} color={colors.muted} />
        <View style={styles.emptyInfo}>
          <Text style={styles.emptyTitle}>No AI provider configured</Text>
          <Text style={styles.emptyNote}>Configure Gemini or DeepSeek to enable AI analysis.</Text>
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
            style={({ pressed }) => [styles.option, isActive && styles.optionActive, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            testID={`ai-active-option-${provider}`}
          >
            <Ionicons name={PROVIDER_ICONS[provider]} size={18} color={isActive ? colors.accent : colors.muted} />
            <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
              {PROVIDER_LABELS[provider]}
            </Text>
            {isActive ? (
              <View style={styles.activeTag} testID={`ai-active-tag-${provider}`}>
                <Text style={styles.activeTagLabel}>Active</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.lg },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  emptyInfo: { flex: 1 },
  emptyTitle: { fontSize: typography.body, fontWeight: '600', color: colors.text },
  emptyNote: { fontSize: typography.caption, color: colors.muted },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  optionActive: { borderColor: colors.accent },
  optionLabel: { flex: 1, fontSize: typography.body, color: colors.text, fontWeight: '600' },
  optionLabelActive: { color: colors.accent },
  activeTag: {
    backgroundColor: colors.accentSoft,
    borderRadius: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  activeTagLabel: { color: colors.accent, fontSize: typography.caption, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});