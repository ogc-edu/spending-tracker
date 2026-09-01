/**
 * EmptyState (plan 006) — the two history empty cases: no expenses at all
 * vs no rows matching the active filters. The screen picks title/body; this
 * renders the icon + copy block.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  testID?: string;
}

export function EmptyState({ icon, title, body, testID }: EmptyStateProps) {
  return (
    <View style={styles.box} testID={testID}>
      <Ionicons name={icon} size={44} color={colors.muted} style={styles.icon} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
  icon: { marginBottom: spacing.md },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  body: { fontSize: typography.body, color: colors.muted, textAlign: 'center' },
});