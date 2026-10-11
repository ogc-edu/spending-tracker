import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';
import { DateTile } from './DateTile';

export interface DueRowProps {
  day: string | number;
  month: string;
  name: string;
  meta: string;
  amount: string;
  progress?: number;
  isLast?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function DueRow({
  day,
  month,
  name,
  meta,
  amount,
  progress,
  isLast = false,
  onPress,
  style,
  testID,
}: DueRowProps) {
  const { colors } = useTheme();

  const hasProgress = typeof progress === 'number';
  const minHeight = hasProgress ? 60 : 52;
  const clampedProgress = hasProgress
    ? Math.max(0, Math.min(100, progress > 1 ? progress : progress * 100))
    : 0;

  const content = (
    <View
      style={[
        styles.row,
        { minHeight },
        !isLast && { borderBottomColor: colors.separator, borderBottomWidth: 1 },
        style,
      ]}
      testID={testID}
    >
      <DateTile day={day} month={month} />

      <View style={styles.middle}>
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
        <Text
          numberOfLines={1}
          style={[
            styles.meta,
            {
              color: colors.textTertiary,
            },
          ]}
        >
          {meta}
        </Text>
        {hasProgress ? (
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
                  backgroundColor: colors.accent,
                  width: `${clampedProgress}%`,
                },
              ]}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.right}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
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
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  middle: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
  },
  name: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amount: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.7,
  },
});
