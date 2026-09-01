import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { colors, spacing, typography } from '@/theme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {user ? (
        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.email} testID="settings-email">
            {user.email}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={logout}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        accessibilityRole="button"
        testID="settings-logout"
      >
        <Text style={styles.buttonLabel}>Log out</Text>
      </Pressable>

      <Text style={styles.note}>Accounts management lands in plan 004; safety buffer and AI keys in later plans.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: spacing.xxl },
  title: { fontSize: typography.title, fontWeight: '700', color: colors.text, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  label: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.xs },
  email: { fontSize: typography.body, fontWeight: '600', color: colors.text },
  button: {
    backgroundColor: colors.danger,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: { color: '#fff', fontSize: typography.emphasis, fontWeight: '600' },
  note: { marginTop: spacing.xl, fontSize: typography.body, color: colors.muted },
});
