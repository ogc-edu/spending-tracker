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

export interface FormGroupProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function FormGroup({ children, style, testID }: FormGroupProps) {
  const { colors } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.group,
        {
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface FormRowProps {
  label: string;
  value?: string | React.ReactNode;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function FormRow({
  label,
  value,
  subtitle,
  right,
  onPress,
  isLast = false,
  disabled = false,
  style,
  testID,
}: FormRowProps) {
  const { colors } = useTheme();

  const content = (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomColor: colors.separator, borderBottomWidth: 1 },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.left}>
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[
              styles.subtitle,
              {
                color: colors.textTertiary,
              },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        {right ? (
          right
        ) : typeof value === 'string' ? (
          <Text
            numberOfLines={1}
            style={[
              styles.value,
              {
                color: colors.text,
              },
            ]}
          >
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
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
  group: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    justifyContent: 'center',
  },
  right: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  subtitle: {
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
