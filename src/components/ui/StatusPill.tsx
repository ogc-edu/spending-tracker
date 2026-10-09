import * as React from 'react';
import { Text, View } from 'react-native';
import { cn } from '@/lib/utils';

export type StatusVariant = 'healthy' | 'warning' | 'danger' | 'neutral' | 'accent';

export interface StatusPillProps extends React.ComponentProps<typeof View> {
  variant: StatusVariant;
  label: string;
  dot?: boolean;
  className?: string;
}

const VARIANT_CONFIG: Record<
  StatusVariant,
  { container: string; text: string; dot: string }
> = {
  healthy: {
    container: 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  warning: {
    container: 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  danger: {
    container: 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/30',
    text: 'text-rose-700 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  neutral: {
    container: 'bg-slate-500/10 dark:bg-slate-500/15 border-slate-500/30',
    text: 'text-slate-700 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
  accent: {
    container: 'bg-cyan-500/10 dark:bg-cyan-500/15 border-cyan-500/30',
    text: 'text-cyan-700 dark:text-cyan-400',
    dot: 'bg-cyan-500',
  },
};

export function StatusPill({
  variant,
  label,
  dot = false,
  className,
  testID,
  ...props
}: StatusPillProps) {
  const config = VARIANT_CONFIG[variant];

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={label}
      className={cn(
        'flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-0.5',
        config.container,
        className
      )}
      {...props}
    >
      {dot ? (
        <View
          testID={testID ? `${testID}-dot` : 'status-pill-dot'}
          className={cn('h-1.5 w-1.5 rounded-full', config.dot)}
        />
      ) : null}
      <Text
        testID={testID ? `${testID}-label` : undefined}
        className={cn('text-xs font-semibold tracking-wide', config.text)}
      >
        {label}
      </Text>
    </View>
  );
}
