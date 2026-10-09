/**
 * List / ListRow / SectionLabel (plan 018) — grouped-list language:
 * rows share ONE surface (a padded-flat Card) with hairline separators,
 * instead of one bordered card per row (the "mini-card stack" noise).
 *
 *  - `List` renders its children inside a flat Card, inserting separators
 *    between them automatically.
 *  - `ListRow` is one row: optional press (ripple + 0.7 pressed), leading
 *    element, custom children. minHeight 56 so rows never feel cramped.
 *  - `SectionLabel` is the date/group header ("Today", "01 Sep").
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Children, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/theme';

export function List({ children, style, testID }: { children: ReactNode; style?: object; testID?: string }) {
  const items = Children.toArray(children);
  return (
    <Card style={[styles.list, style]} testID={testID}>
      {items.map((child, index) => (
        <View key={index}>
          {index > 0 ? <View style={styles.separator} /> : null}
          {child}
        </View>
      ))}
    </Card>
  );
}

export interface ListRowProps {
  children: ReactNode;
  onPress?(): void;
  disabled?: boolean;
  testID?: string;
}

export function ListRow({ children, onPress, disabled = false, testID }: ListRowProps) {
  if (!onPress) {
    return (
      <View style={styles.row} testID={testID}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      android_ripple={{ color: 'rgba(0,0,0,0.05)', borderless: false }}
      accessibilityRole="button"
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

/** Soft circle behind a leading glyph (category color, type icons…). */
export function RowIcon({ icon, color, bg }: { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }) {
  return (
    <View style={[styles.iconWrap, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  list: { padding: 0, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pressed: { opacity: 0.7, backgroundColor: colors.background },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.xl + spacing.xs,
  },
});
