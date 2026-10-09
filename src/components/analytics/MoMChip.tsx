/**
 * MoMChip (Plan 007 / AN-1) — Month-over-Month change indicator vs the
 * previous calendar month (AN-4).
 * ▼ emerald = spending fell (healthy surplus direction),
 * ▲ rose = spending rose (tight/deficit direction),
 * — = previous month was 0 (no baseline available).
 * Soft badge styling with hairline borders and tabular numbers.
 * Preserves test contracts:
 *  - testID="analytics-mom"
 *  - testID="analytics-mom-label"
 */
import { Text, View } from 'react-native';
import { formatSen } from '@/utils/money';

export function MoMChip({
  changeSen,
  changePct,
}: {
  changeSen: number;
  changePct: number | null;
}) {
  if (changePct === null) {
    return (
      <View
        className="self-start rounded-full px-2.5 py-0.5 border bg-muted/20 border-border/60"
        testID="analytics-mom"
      >
        <Text
          className="text-xs font-bold text-muted-foreground"
          testID="analytics-mom-label"
        >
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
      className={`self-start rounded-full px-2.5 py-0.5 border ${
        up
          ? 'bg-rose-500/10 border-rose-500/25'
          : down
            ? 'bg-emerald-500/10 border-emerald-500/25'
            : 'bg-muted/20 border-border/60'
      }`}
      testID="analytics-mom"
    >
      <Text
        className={`text-xs font-bold ${
          up
            ? 'text-rose-600 dark:text-rose-400'
            : down
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground'
        }`}
        style={{ fontVariant: ['tabular-nums'] }}
        testID="analytics-mom-label"
      >
        {arrow ? `${arrow} ` : ''}
        {formatSen(Math.abs(changeSen))} ({sign}
        {changePct.toFixed(1)}%)
      </Text>
    </View>
  );
}
