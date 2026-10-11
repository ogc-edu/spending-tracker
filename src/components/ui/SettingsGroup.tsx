import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { geistWeights, useTheme } from '@/theme';
import { Glyph } from './Glyph';

export interface SettingsGroupProps {
  title?: string;
  headerRight?: React.ReactNode;
  footnote?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SettingsGroup({
  title,
  headerRight,
  footnote,
  children,
  style,
  testID,
}: SettingsGroupProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      {title || headerRight ? (
        <View style={styles.header}>
          {title ? (
            <Text
              style={[
                styles.headerTitle,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {title.toUpperCase()}
            </Text>
          ) : null}
          {headerRight}
        </View>
      ) : null}

      <View
        style={[
          styles.group,
          {
            backgroundColor: colors.surface,
          },
        ]}
      >
        {children}
      </View>

      {footnote ? (
        <Text
          style={[
            styles.footnote,
            {
              color: colors.textTertiary,
            },
          ]}
        >
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

export interface SettingsRowProps {
  label: string;
  value?: string | React.ReactNode;
  sublabel?: string;
  left?: React.ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  minHeight?: number;
  isLast?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SettingsRow({
  label,
  value,
  sublabel,
  left,
  chevron = false,
  destructive = false,
  minHeight = 48,
  isLast = false,
  onPress,
  style,
  testID,
}: SettingsRowProps) {
  const { colors } = useTheme();

  const textColor = destructive ? colors.danger : colors.text;

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
      {left ? <View style={styles.leftIcon}>{left}</View> : null}

      <View style={styles.middle}>
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: textColor,
            },
          ]}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text
            numberOfLines={1}
            style={[
              styles.sublabel,
              {
                color: colors.textTertiary,
              },
            ]}
          >
            {sublabel}
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        {typeof value === 'string' ? (
          <Text
            numberOfLines={1}
            style={[
              styles.value,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {value}
          </Text>
        ) : (
          value
        )}
        {chevron ? (
          <Glyph name="chevron" size={14} color={colors.textTertiary} strokeWidth={2.2} />
        ) : null}
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
  container: {
    gap: 8,
  },
  header: {
    marginHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  headerTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    letterSpacing: 0.5,
  },
  group: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  footnote: {
    marginHorizontal: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  row: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leftIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  middle: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  sublabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginTop: 2,
  },
  value: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  pressed: {
    opacity: 0.7,
  },
});
