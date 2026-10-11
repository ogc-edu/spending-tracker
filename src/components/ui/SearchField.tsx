import React from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { geistWeights, useTheme } from '@/theme';
import { Glyph } from './Glyph';

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  accessibilityLabel = 'Search',
  style,
  testID,
}: SearchFieldProps) {
  const { colors } = useTheme();

  return (
    <View
      hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }}
      style={[
        styles.container,
        {
          backgroundColor: colors.fill,
        },
        style,
      ]}
      testID={testID}
    >
      <Glyph name="search" size={16} color={colors.textTertiary} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.input,
          {
            color: colors.text,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    margin: 0,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: geistWeights.medium,
  },
});
