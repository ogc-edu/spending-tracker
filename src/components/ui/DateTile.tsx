import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

export interface DateTileProps {
  day: string | number;
  month: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function DateTile({ day, month, style, testID }: DateTileProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: colors.fill,
        },
        style,
      ]}
      testID={testID}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.day,
          {
            color: colors.text,
          },
        ]}
      >
        {day}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          styles.month,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        {month.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  day: {
    fontSize: 15,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    fontVariant: tabularNumsVariant,
    textAlign: 'center',
  },
  month: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    letterSpacing: 0.54,
    textAlign: 'center',
  },
});
