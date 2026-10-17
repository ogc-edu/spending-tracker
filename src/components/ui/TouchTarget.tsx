import * as React from 'react';
import { TouchableOpacity } from 'react-native';
import { cn } from '@/lib/utils';

export interface TouchTargetProps extends React.ComponentProps<typeof TouchableOpacity> {
  minHeight?: number;
  className?: string;
  children: React.ReactNode;
}

// TouchableOpacity + static style array, not Pressable's style function: NativeWind's css-interop
// drops function styles on Android, which would lose the min hit-target size.
export function TouchTarget({
  minHeight = 44,
  className,
  children,
  style,
  accessibilityRole = 'button',
  ...props
}: TouchTargetProps) {
  return (
    <TouchableOpacity
      accessibilityRole={accessibilityRole}
      className={cn('justify-center items-center', className)}
      activeOpacity={0.7}
      style={[{ minHeight, minWidth: minHeight }, style]}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
}
