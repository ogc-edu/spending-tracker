import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { geistWeights, useTheme } from '@/theme';

export interface ScreenTitleBlockProps {
  title: string;
  caption?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ScreenTitleBlock({
  title,
  caption,
  right,
  style,
  testID,
}: ScreenTitleBlockProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 20) + 4,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.left}>
        {caption ? (
          <Text
            numberOfLines={1}
            style={[
              styles.caption,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {caption}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            {
              color: colors.text,
            },
          ]}
        >
          {title}
        </Text>
      </View>

      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    letterSpacing: -0.56,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
