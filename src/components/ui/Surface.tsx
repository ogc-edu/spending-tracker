import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export interface SurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Surface({ children, style, testID }: SurfaceProps) {
  const { colors } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.surface,
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

const styles = StyleSheet.create({
  surface: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
