/**
 * Skeleton (plan 018) — layout-shaped loading placeholders replacing the
 * lone centered ActivityIndicator on the tabs. Static tinted blocks that
 * mirror the destination's layout (hero + cards / rows), so first paint
 * reads as "the screen is coming", not "nothing is happening".
 *
 * Pure Views — no animation dependency, no shimmer; the shapes carry the
 * information ("content is coming here") which is the point.
 */
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

function Box({ style }: { style?: object }) {
  return <View style={[styles.box, style]} />;
}

export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Box style={styles.rowIcon} />
      <View style={styles.rowLines}>
        <Box style={styles.rowTitle} />
        <Box style={styles.rowMeta} />
      </View>
      <Box style={styles.rowAmount} />
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Box style={styles.cardTitle} />
      <Box style={styles.cardLine} />
    </View>
  );
}

/** Dashboard/analytics first paint: hero block + two cards. */
export function SkeletonHome() {
  return (
    <View>
      <View style={styles.hero}>
        <Box style={styles.heroBadge} />
        <Box style={styles.heroAmount} />
        <View style={styles.heroRow}>
          <Box style={styles.heroPanel} />
          <Box style={styles.heroPanel} />
        </View>
      </View>
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

/** 2×2 stat grid placeholder (analytics). */
export function SkeletonGrid() {
  return (
    <View style={styles.grid}>
      <Box style={styles.cell} />
      <Box style={styles.cell} />
      <Box style={styles.cell} />
      <Box style={styles.cell} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.border,
    opacity: 0.55,
    borderRadius: radius.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 20 },
  rowLines: { flex: 1, gap: spacing.xs },
  rowTitle: { height: 14, width: '60%' },
  rowMeta: { height: 10, width: '40%' },
  rowAmount: { width: 72, height: 14 },
  cardTitle: { height: 12, width: '35%', marginBottom: spacing.md },
  cardLine: { height: 18, width: '55%' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  hero: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  heroBadge: { height: 12, width: 120, borderRadius: 6, marginBottom: spacing.md },
  heroAmount: { height: 34, width: '65%', borderRadius: 8, marginBottom: spacing.lg },
  heroRow: { flexDirection: 'row', gap: spacing.md },
  heroPanel: { flex: 1, height: 40, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.25)' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  cell: { width: '48%', height: 96, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
});
