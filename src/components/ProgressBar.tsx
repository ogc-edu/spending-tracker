/**
 * ProgressBar (plan 007) — a thin usage bar shared by the Budgets tab and the
 * Dashboard (010). Pure presentation: the fill is `pct` capped at 100 (over
 * budget → full bar, but painted danger so the state stays visible); the
 * caller chooses the normal color and flips `danger` for the over-budget
 * state (plan 007: over-budget is a color + label, never a notification).
 */
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

export function ProgressBar({
  pct,
  color,
  danger = false,
  testID,
}: {
  /** Percentage used — 0–100+; the fill itself caps visually at 100. */
  pct: number;
  /** Fill color for the normal state. */
  color: string;
  /** True → danger coloring (over-budget) regardless of pct value. */
  danger?: boolean;
  testID?: string;
}) {
  const fill = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.track} testID={testID}>
      <View
        style={[
          styles.fill,
          { width: `${fill}%`, backgroundColor: danger ? colors.danger : color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
});