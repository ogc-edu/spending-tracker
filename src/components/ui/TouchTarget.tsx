import * as React from 'react';
import { Pressable } from 'react-native';
import { cn } from '@/lib/utils';

export interface TouchTargetProps extends React.ComponentProps<typeof Pressable> {
  minHeight?: number;
  className?: string;
  children: React.ReactNode;
}

export function TouchTarget({
  minHeight = 44,
  className,
  children,
  style,
  accessibilityRole = 'button',
  ...props
}: TouchTargetProps) {
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      className={cn('justify-center items-center', className)}
      style={(state) => [
        { minHeight, minWidth: minHeight },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
