/**
 * Plan 013 — ProviderRow: one card in the Settings AI Provider section.
 * Shows the provider name + status: "Not configured" (muted) or a masked key
 * suffix (e.g. ••••••••••••ABCD) — never the full credential. Tapping opens
 * the provider's config screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConfigurableAIProvider } from '@/services/AiConfigService';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { PROVIDER_ICONS, PROVIDER_LABELS } from './providerMeta';

export const MASK_BULLETS = '•'.repeat(12);

/** Mask a key for display: 12 bullets + the last `visible` chars (••••••••••••ABCD). */
export function maskKeySuffix(key: string, visible = 4): string {
  if (key.length <= visible) return '•'.repeat(key.length);
  return MASK_BULLETS + key.slice(-visible);
}

export function ProviderRow({
  provider,
  configured,
  suffix,
  onPress,
}: {
  provider: ConfigurableAIProvider;
  configured: boolean;
  /** Masked key suffix (only meaningful when configured). */
  suffix: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${PROVIDER_LABELS[provider]} settings`}
      testID={`ai-provider-row-${provider}`}
    >
      <Ionicons name={PROVIDER_ICONS[provider]} size={20} color={colors.accent} style={styles.icon} />
      <View style={styles.info}>
        <Text style={styles.name}>{PROVIDER_LABELS[provider]}</Text>
        <Text
          style={configured ? styles.masked : styles.notConfigured}
          testID={`ai-provider-status-${provider}`}
        >
          {configured && suffix ? suffix : 'Not configured'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  icon: { marginRight: spacing.md },
  info: { flex: 1, marginRight: spacing.sm },
  name: { fontSize: typography.body, fontWeight: '600', color: colors.text },
  masked: { fontSize: typography.caption, color: colors.muted, fontVariant: moneyFontVariant },
  notConfigured: { fontSize: typography.caption, color: colors.muted, fontStyle: 'italic' },
  pressed: { opacity: 0.7 },
});