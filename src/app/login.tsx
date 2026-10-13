import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Redirect } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { useAuth } from '@/auth/AuthProvider';
import { FormGroup, FormRow } from '@/components/ui/FormGroup';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { geistWeights, useTheme } from '@/theme';

import { DEFAULT_USER_EMAIL, DEFAULT_USER_PASSWORD } from '@/db/seedUser';

const schema = z.object({
  email: z.string().trim().min(1, 'Email required').email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const { status, login } = useAuth();
  const { colors } = useTheme();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: DEFAULT_USER_EMAIL, password: DEFAULT_USER_PASSWORD },
  });

  if (status === 'signedIn') {
    return <Redirect href={"/(tabs)" as never} />;
  }

  if (status === 'loading') {
    return (
      <View style={[styles.loadingBox, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setFormError(message);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Centred App Icon & Header */}
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
              <Ionicons name="wallet-outline" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Spending Tracker</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign in to manage your finances
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            <FormGroup>
              <Controller
                control={control}
                name="email"
                render={({ field: { value, onChange, onBlur } }) => (
                  <FormRow
                    label="Email"
                    right={
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        placeholder="you@example.com"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Email address"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        editable={!isSubmitting}
                        testID="login-email"
                      />
                    }
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { value, onChange, onBlur } }) => (
                  <FormRow
                    label="Password"
                    isLast
                    right={
                      <View style={styles.passwordRow}>
                        <TextInput
                          style={[styles.input, { color: colors.text }]}
                          autoCapitalize="none"
                          autoCorrect={false}
                          secureTextEntry={!showPassword}
                          placeholder="Password"
                          placeholderTextColor={colors.textTertiary}
                          accessibilityLabel="Password"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          editable={!isSubmitting}
                          testID="login-password"
                        />
                        <Pressable
                          onPress={() => setShowPassword(!showPassword)}
                          accessibilityRole="button"
                          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                          hitSlop={8}
                          testID="login-toggle-password"
                          style={styles.eyeButton}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={18}
                            color={colors.textTertiary}
                          />
                        </Pressable>
                      </View>
                    }
                  />
                )}
              />
            </FormGroup>

            {formError ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {formError}
              </Text>
            ) : null}

            <PrimaryButton
              label="Sign in"
              loading={isSubmitting}
              onPress={handleSubmit(onSubmit)}
              testID="login-submit"
            />

            <View style={styles.footerRow}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                Don’t have an account?{' '}
              </Text>
              <Link href={"/register" as never} asChild>
                <Pressable testID="login-register-link">
                  <Text style={[styles.linkText, { color: colors.link }]}>
                    Sign up
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    letterSpacing: -0.56,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: geistWeights.medium,
    marginTop: 4,
  },
  formSection: {
    gap: 16,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: geistWeights.medium,
    textAlign: 'right',
    paddingVertical: 12,
  },
  passwordRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  eyeButton: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: geistWeights.medium,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: geistWeights.regular,
  },
  linkText: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: geistWeights.semiBold,
    fontWeight: '600',
  },
});
