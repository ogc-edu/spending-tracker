import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

/** Temporary scaffold screen — replaced by feature implementations (004+). */
export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: { fontSize: typography.title, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  note: { fontSize: typography.body, color: colors.muted },
});