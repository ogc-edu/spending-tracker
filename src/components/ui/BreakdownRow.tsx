import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

export interface BreakdownRowProps {
  name: string;
  pct: number;
  amount: string;
  isLast?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function BreakdownRow({
  name,
  pct,
  amount,
  isLast = false,
  style,
  testID,
}: BreakdownRowProps) {
  const { colors } = useTheme();

  const clampedPct = Math.max(0, Math.min(100, pct));

  return (
    <View
      style={[
        styles.container,
        !isLast && { borderBottomColor: colors.separator, borderBottomWidth: 1 },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.topRow}>
        <Text
          numberOfLines={1}
          style={[
            styles.name,
            {
              color: colors.text,
            },
          ]}
        >
          {name}
        </Text>
        <View style={styles.rightValues}>
          <Text
            numberOfLines={1}
            style={[
              styles.pct,
              {
                color: colors.textTertiary,
              },
            ]}
          >
            {clampedPct}%
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.amount,
              {
                color: colors.text,
              },
            ]}
          >
            {amount}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.track,
          {
            backgroundColor: colors.track,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.barMuted,
              width: `${clampedPct}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  rightValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pct: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontVariant: tabularNumsVariant,
    marginRight: 8,
  },
  amount: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
    textAlign: 'right',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
});
