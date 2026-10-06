import * as React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type CardTone = 'plain' | 'tint' | 'danger' | 'accent';

export interface CardProps extends React.ComponentProps<typeof View> {
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  className?: string;
}

function Card({
  className,
  tone = 'plain',
  style,
  testID,
  children,
  ...props
}: CardProps) {
  const toneClasses = {
    plain: 'bg-card border-border',
    tint: 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40',
    danger: 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40',
    accent: 'bg-primary border-primary',
  }[tone];

  const textContext = tone === 'accent' ? 'text-primary-foreground' : 'text-card-foreground';

  return (
    <TextClassContext.Provider value={textContext}>
      <View
        testID={testID}
        className={cn(
          'rounded-2xl border border-border bg-card p-5',
          toneClasses,
          className
        )}
        style={style}
        {...props}
      >
        {children}
      </View>
    </TextClassContext.Provider>
  );
}

function CardHeader({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('flex flex-col gap-1.5 pb-3', className)} {...props} />;
}

function CardTitle({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {
  return (
    <Text
      ref={ref}
      role="heading"
      aria-level={3}
      className={cn('text-lg font-bold tracking-tight text-foreground leading-snug', className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {
  return (
    <Text
      className={cn('text-muted-foreground text-sm font-medium leading-relaxed', className)}
      {...props}
    />
  );
}

function CardContent({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('pt-1', className)} {...props} />;
}

function CardFooter({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return (
    <View
      className={cn('flex flex-row items-center justify-between pt-4', className)}
      {...props}
    />
  );
}

/** Small uppercase micro-label used at the top of cards ("Available Balance"). */
function CardLabel({
  children,
  onAccent = false,
  className,
}: {
  children: React.ReactNode;
  onAccent?: boolean;
  className?: string;
}) {
  return (
    <Text
      className={cn(
        'text-xs font-bold uppercase tracking-wider text-muted-foreground',
        onAccent && 'text-primary-foreground/80',
        className
      )}
    >
      {children}
    </Text>
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardLabel,
};
