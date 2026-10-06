import * as React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { spokenMoneyLabel } from '@/utils/money';
import { cn } from '@/lib/utils';

export type MoneyDisplaySize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'hero';

export interface MoneyDisplayProps extends React.ComponentProps<typeof Text> {
  amountInSen: number;
  size?: MoneyDisplaySize;
  trendPrefix?: boolean;
  dimCents?: boolean;
  className?: string;
  style?: StyleProp<TextStyle>;
}

const SIZE_CLASSES: Record<MoneyDisplaySize, string> = {
  xs: 'text-xs font-semibold',
  sm: 'text-sm font-semibold',
  base: 'text-base font-semibold',
  lg: 'text-xl font-bold tracking-tight',
  xl: 'text-2xl font-black tracking-tight',
  hero: 'text-4xl sm:text-5xl font-black tracking-tighter',
};

export function MoneyDisplay({
  amountInSen,
  size = 'base',
  trendPrefix = false,
  dimCents = false,
  className,
  style,
  accessibilityLabel,
  testID,
  ...props
}: MoneyDisplayProps) {
  const absSen = Math.abs(amountInSen);
  const ringgitStr = Math.floor(absSen / 100).toLocaleString('en-MY');
  const centsStr = (absSen % 100).toString().padStart(2, '0');

  let sign = '';
  if (amountInSen < 0) {
    sign = '-';
  } else if (trendPrefix && amountInSen > 0) {
    sign = '+';
  }

  const defaultA11yLabel = React.useMemo(() => {
    const base = spokenMoneyLabel(amountInSen);
    if (trendPrefix && amountInSen > 0) {
      return `plus ${base}`;
    }
    return base;
  }, [amountInSen, trendPrefix]);

  return (
    <Text
      testID={testID}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      className={cn('text-foreground font-sans', SIZE_CLASSES[size], className)}
      accessibilityLabel={accessibilityLabel ?? defaultA11yLabel}
      {...props}
    >
      {sign}RM{ringgitStr}
      {dimCents ? (
        <Text testID={testID ? `${testID}-cents` : undefined} className="opacity-60">
          {`.${centsStr}`}
        </Text>
      ) : (
        `.${centsStr}`
      )}
    </Text>
  );
}
