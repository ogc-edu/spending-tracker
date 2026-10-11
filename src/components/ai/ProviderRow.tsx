/**
 * Plan 013 — ProviderRow: one card in the Settings AI Provider section.
 * Shows the provider name + status: "Not configured" (muted) or a masked key
 * suffix (e.g. ••••••••••••ABCD) — never the full credential. Tapping opens
 * the provider's config screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConfigurableAIProvider } from '@/services/AiConfigService';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';
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
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.separator,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${PROVIDER_LABELS[provider]} settings`}
      testID={`ai-provider-row-${provider}`}
    >
      <Ionicons
        name={PROVIDER_ICONS[provider]}
        size={20}
        color={colors.accent}
        style={styles.icon}
      />
      <View style={styles.info}>
        <Text
          numberOfLines={1}
          style={[styles.name, { color: colors.text }]}
        >
          {PROVIDER_LABELS[provider]}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.status,
            { color: colors.textSecondary },
            configured && styles.masked,
          ]}
          testID={`ai-provider-status-${provider}`}
        >
          {configured && suffix ? suffix : 'Not configured'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  icon: {
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  status: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: geistWeights.regular,
    marginTop: 2,
  },
  masked: {
    fontVariant: tabularNumsVariant,
  },
  pressed: {
    opacity: 0.7,
  },
});