import * as React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { cn } from '@/lib/utils';

export interface BudgetMeterProps extends React.ComponentProps<typeof View> {
  spentSen: number;
  totalSen: number;
  customColor?: string;
  heightClass?: string;
  className?: string;
}

export function BudgetMeter({
  spentSen,
  totalSen,
  customColor,
  heightClass = 'h-2',
  className,
  style,
  testID,
  accessibilityLabel,
  ...props
}: BudgetMeterProps) {
  const percentage = totalSen > 0 ? (spentSen / totalSen) * 100 : spentSen > 0 ? 100 : 0;
  const fillPercent = Math.min(100, Math.max(0, percentage));

  let thresholdColorClass = 'bg-primary';
  if (percentage >= 100) {
    thresholdColorClass = 'bg-destructive';
  } else if (percentage >= 80) {
    thresholdColorClass = 'bg-warning';
  }

  const isCustomClass = customColor?.startsWith('bg-');
  const barColorClass = isCustomClass ? customColor : customColor ? undefined : thresholdColorClass;
  const barStyle: StyleProp<ViewStyle> = [
    { width: `${fillPercent}%` },
    customColor && !isCustomClass ? { backgroundColor: customColor } : undefined,
  ];

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fillPercent) }}
      accessibilityLabel={accessibilityLabel ?? `Budget progress: ${Math.round(percentage)}%`}
      className={cn(
        'w-full overflow-hidden rounded-full bg-muted/40 border border-border/40',
        heightClass,
        className
      )}
      style={style}
      {...props}
    >
      <View
        testID={testID ? `${testID}-bar` : 'budget-meter-bar'}
        className={cn('h-full rounded-full transition-all', barColorClass)}
        style={barStyle}
      />
    </View>
  );
}
