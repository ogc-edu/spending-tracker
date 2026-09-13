/**
 * MoMChip (plan 011, AN-1; restyled by plan 017) — month-over-month change vs
 * the PREVIOUS calendar month (AN-4). ▼ green = spending FELL (good), ▲ red =
 * rose (bad, mirrors the app's danger tone for over-spending); a flat month
 * shows no arrow. Plan 017: the chip now uses the SOFT badge language every
 * other status pill uses (tinted background + tone text) instead of a solid
 * saturated fill. When changePct is null (previous month total 0) the change
 * is undefined and the chip renders "—" (AN-1). Pure presentation — the
 * numbers are the engine's.
 */
import { StyleSheet, Text, View } from 'react-native';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

export function MoMChip({
  changeSen,
  changePct,
}: {
  changeSen: number;
  changePct: number | null;
}) {
  if (changePct === null) {
    return (
      <View style={[styles.chip, styles.neutral]} testID="analytics-mom">
        <Text style={styles.neutralText} testID="analytics-mom-label">
          —
        </Text>
      </View>
    );
  }

  const up = changeSen > 0;
  const down = changeSen < 0;
  const arrow = up ? '▲' : down ? '▼' : '';
  const sign = changePct > 0 ? '+' : '';

  return (
    <View
      style={[styles.chip, up ? styles.up : down ? styles.down : styles.flat]}
      testID="analytics-mom"
    >
      <Text
        style={[styles.text, up ? styles.upText : down ? styles.downText : styles.neutralText]}
        testID="analytics-mom-label"
      >
        {arrow ? `${arrow} ` : ''}
        {formatSen(Math.abs(changeSen))} ({sign}
        {changePct.toFixed(1)}%)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  up: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  down: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  flat: { backgroundColor: colors.background, borderColor: colors.border },
  upText: { color: colors.danger, fontSize: typography.caption, fontWeight: '700' },
  downText: { color: colors.accent, fontSize: typography.caption, fontWeight: '700' },
  text: { fontSize: typography.caption, fontWeight: '700' },
  neutral: { backgroundColor: colors.muted },
  neutralText: { color: colors.surface, fontSize: typography.caption, fontWeight: '700' },
});
