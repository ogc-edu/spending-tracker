import * as React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cva, type VariantProps } from 'class-variance-authority';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 rounded-xl border border-transparent shadow-none',
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: 'bg-primary active:opacity-90',
        primary: 'bg-primary active:opacity-90',
        destructive: 'bg-destructive active:opacity-90',
        danger: 'bg-destructive active:opacity-90',
        outline: 'border-border bg-background active:bg-accent',
        secondary: 'border-border bg-secondary active:opacity-80 border',
        ghost: 'bg-transparent active:bg-accent',
        link: 'bg-transparent',
      },
      size: {
        default: 'min-h-[48px] px-5 py-3',
        sm: 'min-h-[44px] px-3.5 py-2 rounded-lg',
        lg: 'min-h-[52px] px-7 py-3.5 rounded-xl',
        icon: 'min-h-[44px] min-w-[44px] p-2 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva(
  cn(
    'text-sm font-semibold',
    Platform.select({ web: 'pointer-events-none transition-colors' })
  ),
  {
    variants: {
      variant: {
        default: 'text-primary-foreground',
        primary: 'text-primary-foreground',
        destructive: 'text-destructive-foreground',
        danger: 'text-destructive-foreground',
        outline: 'text-foreground',
        secondary: 'text-secondary-foreground',
        ghost: 'text-foreground',
        link: 'text-primary underline',
      },
      size: {
        default: 'text-base font-semibold',
        sm: 'text-sm font-medium',
        lg: 'text-lg font-bold',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

export interface ButtonProps
  extends Omit<React.ComponentProps<typeof Pressable>, 'style'>,
    VariantProps<typeof buttonVariants> {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  busy?: boolean;
  flex?: boolean;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  label,
  icon,
  busy = false,
  disabled = false,
  flex = false,
  children,
  style,
  testID,
  ...props
}: ButtonProps) {
  const inactive = disabled || busy;

  const textColorClass = buttonTextVariants({ variant, size });
  const isDarkBg = variant === 'default' || variant === 'primary' || variant === 'destructive' || variant === 'danger';
  const spinnerColor = isDarkBg ? '#ffffff' : '#0f172a';

  return (
    <TextClassContext.Provider value={textColorClass}>
      <Pressable
        testID={testID}
        disabled={inactive}
        className={cn(
          buttonVariants({ variant, size }),
          flex && 'flex-1',
          inactive && 'opacity-50',
          className
        )}
        style={({ pressed }) => [
          { minHeight: 48 },
          flex ? { flex: 1 } : undefined,
          inactive ? { opacity: 0.55 } : undefined,
          pressed ? { opacity: 0.85 } : undefined,
          typeof style === 'function' ? style({ pressed }) : style,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: inactive, busy }}
        {...props}
      >
        {busy ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : label !== undefined ? (
          <>
            {icon ? (
              <Ionicons
                name={icon}
                size={18}
                color={isDarkBg ? '#ffffff' : '#0f172a'}
              />
            ) : null}
            <Text className={cn(textColorClass, 'text-center')}>
              {label}
            </Text>
          </>
        ) : (
          children
        )}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
