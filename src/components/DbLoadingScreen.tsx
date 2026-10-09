import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';

/** Shown while the database initializes or recovers. */
export function DbLoadingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.brandIconWrap}>
        <Ionicons name="wallet" size={32} color={colors.accent} />
      </View>
      <Text style={styles.title}>Spending Tracker</Text>
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.note}>Preparing your finances…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brandIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
    letterSpacing: -0.3,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  note: {
    fontSize: typography.body,
    color: colors.muted,
    fontWeight: '500',
  },
});