/**
 * SectionHeader (plan 017) — one consistent section title for Budgets,
 * Analytics and Settings: bold title, optional muted note underneath, and an
 * optional trailing element (e.g. the categories Delete/Done actions).
 * Replaces the drift of ad-hoc sectionTitle/sectionNote style pairs.
 */
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

export function SectionHeader({
  title,
  note,
  trailing,
}: {
  title: string;
  note?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.xl, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    fontSize: typography.emphasis,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  trailing: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  note: { fontSize: typography.caption, color: colors.muted, marginTop: spacing.xs, fontWeight: '500' },
});
