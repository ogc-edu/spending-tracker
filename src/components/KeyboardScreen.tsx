/**
 * KeyboardScreen (plan 016 iOS parity) — wraps a form screen in a
 * KeyboardAvoidingView so the keyboard never covers focused inputs on
 * iOS (Android resizes the window natively). Applied to every screen with
 * a TextInput: expense form, commitment form, provider config, login,
 * register. Behavior is Platform-gated: 'padding' on iOS, undefined on
 * Android (the system adjustResize does the work).
 */
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { colors } from '@/theme';

export function KeyboardScreen({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});