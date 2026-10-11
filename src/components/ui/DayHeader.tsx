import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

export interface DayHeaderProps {
  title: string;
  total?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function DayHeader({ title, total, style, testID }: DayHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text
        numberOfLines={1}
        style={[
          styles.title,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        {title.toUpperCase()}
      </Text>
      {total ? (
        <Text
          numberOfLines={1}
          style={[
            styles.total,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          {total}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    letterSpacing: 0.5,
  },
  total: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
    textAlign: 'right',
  },
});
