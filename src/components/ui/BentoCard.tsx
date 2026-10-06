import * as React from 'react';
import { View } from 'react-native';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface BentoCardProps extends React.ComponentProps<typeof View> {
  elevated?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function BentoCard({
  elevated = false,
  className,
  children,
  testID,
  style,
  ...props
}: BentoCardProps) {
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View
        testID={testID}
        className={cn(
          'bg-card rounded-2xl border p-4 overflow-hidden',
          elevated
            ? 'border-border/80 shadow-sm bg-card'
            : 'border-border/60',
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
