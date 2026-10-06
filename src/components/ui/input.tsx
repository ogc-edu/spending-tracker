import { cn } from '@/lib/utils';
import { Platform, TextInput } from 'react-native';

function Input({ className, style, ...props }: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      style={[{ minHeight: 48 }, style]}
      className={cn(
        'border border-border bg-card text-foreground flex min-h-[48px] w-full min-w-0 flex-row items-center rounded-lg px-3.5 py-2 text-base leading-5',
        props.editable === false &&
        cn(
          'opacity-50',
          Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
        ),
        Platform.select({
          web: cn(
            'placeholder:text-muted outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
          ),
          native: 'placeholder:text-muted',
        }),
        className
      )}
      placeholderTextColor="#64748B"
      {...props}
    />
  );
}

export { Input };
