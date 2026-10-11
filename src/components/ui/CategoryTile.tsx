import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { categoryPalette, geistWeights, useTheme } from '@/theme';

export interface CategoryTileProps {
  categoryIndex?: number;
  name?: string;
  initial?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function CategoryTile({
  categoryIndex,
  name,
  initial,
  icon,
  style,
  testID,
}: CategoryTileProps) {
  const { scheme, colors } = useTheme();

  let index = 0;
  if (typeof categoryIndex === 'number') {
    index = Math.max(0, categoryIndex >= 1 ? categoryIndex - 1 : categoryIndex) % categoryPalette.length;
  } else if (name) {
    const found = categoryPalette.findIndex(
      (c) => c.seed.toLowerCase() === name.toLowerCase(),
    );
    index = found >= 0 ? found : 0;
  }

  const palette = categoryPalette[index] ?? categoryPalette[0];

  const isLight = scheme === 'light';
  const bgColor = isLight ? palette.lightTile : colors.fill;
  const fgColor = isLight ? palette.lightFg : palette.darkFg;

  const letter = (initial ?? name?.[0] ?? palette.seed[0] ?? '?').toUpperCase();

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: bgColor,
        },
        style,
      ]}
      testID={testID}
    >
      {icon ? (
        <Ionicons name={icon} size={16} color={fgColor} />
      ) : (
        <Text
          numberOfLines={1}
          style={[
            styles.letter,
            {
              color: fgColor,
            },
          ]}
        >
          {letter}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  letter: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    textAlign: 'center',
  },
});
