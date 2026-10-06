/**
 * Badge — status pill composed with NativeWind and RNR aesthetic.
 * Follows subtle hairline borders instead of aggressive shadows.
 */
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { cn } from '@/lib/utils';

export type BadgeTone = 'accent' | 'danger' | 'warning' | 'neutral' | 'onAccent';

const TONES: Record<BadgeTone, { bg: string; fg: string; className: string; textClass: string }> = {
  accent: {
    bg: colors.accentSoft,
    fg: colors.accent,
    className: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/40',
    textClass: 'text-emerald-700 dark:text-emerald-300',
  },
  danger: {
    bg: colors.dangerSoft,
    fg: colors.danger,
    className: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-800/40',
    textClass: 'text-rose-700 dark:text-rose-300',
  },
  warning: {
    bg: colors.warningSoft,
    fg: colors.warning,
    className: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/40',
    textClass: 'text-amber-700 dark:text-amber-300',
  },
  neutral: {
    bg: colors.background,
    fg: colors.muted,
    className: 'bg-muted/50 border-border',
    textClass: 'text-muted-foreground',
  },
  onAccent: {
    bg: 'rgba(15,23,42,0.14)',
    fg: colors.surface,
    className: 'bg-black/15 border-white/20',
    textClass: 'text-white',
  },
};

export function Badge({
  tone = 'neutral',
  label,
  icon,
  className,
  style,
  testID,
}: {
  tone?: BadgeTone;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const toneStyle = TONES[tone];
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 self-start rounded-md border px-2 py-0.5',
        toneStyle.className,
        className
      )}
      style={[{ backgroundColor: toneStyle.bg }, style]}
      testID={testID}
    >
      {icon ? <Ionicons name={icon} size={11} color={toneStyle.fg} /> : null}
      <Text
        className={cn('text-xs font-bold tracking-wide', toneStyle.textClass)}
        style={{ color: toneStyle.fg }}
      >
        {label}
      </Text>
    </View>
  );
}
