import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Redirect } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';

const schema = z
  .object({
    email: z.string().trim().min(1, 'Email required').email('Invalid email'),
    password: z.string().min(1, 'Password required'),
    confirm: z.string().min(1, 'Please confirm your password'),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterScreen() {
  const { status, register } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirm: '' },
  });

  if (status === 'signedIn') {
    return <Redirect href={"/(tabs)" as never} />;
  }

  if (status === 'loading') {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator color="#15803D" />
      </View>
    );
  }

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      await register(values.email, values.password);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setFormError(message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1 px-6 justify-center"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 items-center justify-center mb-3 border border-emerald-200 dark:border-emerald-800/30">
            <Ionicons name="wallet" size={32} color="#15803D" />
          </View>
          <Text className="text-2xl font-extrabold text-foreground tracking-tight">Create account</Text>
          <Text className="text-sm font-medium text-muted-foreground mt-1">Register to start tracking your finances</Text>
        </View>

        <Card className="p-6 border border-border shadow-none">
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <View className="mb-4">
                <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5" nativeID="register-label-email">
                  Email
                </Text>
                <Input
                  className="min-h-[48px] h-12 rounded-xl bg-background border border-border px-4 text-base text-foreground"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor="#6B7280"
                  accessibilityLabel="Email address"
                  accessibilityLabelledBy="register-label-email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  editable={!isSubmitting}
                  testID="register-email"
                />
                {error ? <Text className="text-destructive text-xs font-semibold mt-1.5">{error.message}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <View className="mb-4">
                <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5" nativeID="register-label-password">
                  Password
                </Text>
                <View className="relative justify-center">
                  <Input
                    className="min-h-[48px] h-12 rounded-xl bg-background border border-border pl-4 pr-12 text-base text-foreground"
                    secureTextEntry={!showPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#6B7280"
                    accessibilityLabel="Password"
                    accessibilityLabelledBy="register-label-password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    editable={!isSubmitting}
                    testID="register-password"
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-0 bottom-0 w-12 min-h-[44px] items-center justify-center"
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#6B7280"
                    />
                  </Pressable>
                </View>
                {error ? <Text className="text-destructive text-xs font-semibold mt-1.5">{error.message}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="confirm"
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <View className="mb-4">
                <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5" nativeID="register-label-confirm">
                  Confirm Password
                </Text>
                <Input
                  className="min-h-[48px] h-12 rounded-xl bg-background border border-border px-4 text-base text-foreground"
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#6B7280"
                  accessibilityLabel="Confirm password"
                  accessibilityLabelledBy="register-label-confirm"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  editable={!isSubmitting}
                  testID="register-confirm"
                />
                {error ? <Text className="text-destructive text-xs font-semibold mt-1.5">{error.message}</Text> : null}
              </View>
            )}
          />

          {formError ? (
            <View className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4" testID="register-error">
              <Text className="text-destructive text-sm font-medium">{formError}</Text>
            </View>
          ) : null}

          <Button
            label="Create account"
            variant="default"
            size="default"
            busy={isSubmitting}
            disabled={isSubmitting}
            onPress={handleSubmit(onSubmit)}
            testID="register-submit"
            className="mt-2"
          />
        </Card>

        <View className="flex-row justify-center mt-6 items-center">
          <Text className="text-muted-foreground text-sm font-medium">Already have an account? </Text>
          <Link href={"/login" as never} className="text-primary text-sm font-bold min-h-[44px] justify-center items-center py-2" testID="register-login-link">
            Log in
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
