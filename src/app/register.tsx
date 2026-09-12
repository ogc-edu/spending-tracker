import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Redirect } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { useAuth } from '@/auth/AuthProvider';
import { colors, spacing, typography } from '@/theme';

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
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.brandHeader}>
          <View style={styles.brandIconWrap}>
            <Ionicons name="wallet" size={32} color={colors.accent} />
          </View>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Register to start tracking your finances</Text>
        </View>

        <View style={styles.card}>
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Email address"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  editable={!isSubmitting}
                  testID="register-email"
                />
                {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, error && styles.inputError]}
                    secureTextEntry={!showPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.muted}
                    accessibilityLabel="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    editable={!isSubmitting}
                    testID="register-password"
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.eyeButton}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>
                {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="confirm"
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Confirm password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  editable={!isSubmitting}
                  testID="register-confirm"
                />
                {error ? <Text style={styles.fieldError}>{error.message}</Text> : null}
              </View>
            )}
          />

          {formError ? (
            <View style={styles.errorBox} testID="register-error">
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            accessibilityRole="button"
            testID="register-submit"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonLabel}>Create account</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href={"/login" as never} style={styles.link} testID="register-login-link">
            Log in
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, justifyContent: 'center' },
  brandHeader: { alignItems: 'center', marginBottom: spacing.xl },
  brandIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: spacing.xs, letterSpacing: -0.4 },
  subtitle: { fontSize: typography.body, color: colors.muted, fontWeight: '500' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  field: { marginBottom: spacing.md },
  label: { fontSize: typography.caption, fontWeight: '700', color: colors.text, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: colors.background,
  },
  passwordContainer: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { marginTop: spacing.xs, color: colors.danger, fontSize: typography.caption, fontWeight: '500' },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontSize: typography.body, fontWeight: '500' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonLabel: { color: '#fff', fontSize: typography.emphasis, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.muted, fontSize: typography.body, fontWeight: '500' },
  link: { color: colors.accent, fontSize: typography.body, fontWeight: '700' },
});
