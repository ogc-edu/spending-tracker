import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { geistWeights, useTheme } from '@/theme';
import { TextLinkButton } from './TextLinkButton';

export interface EmptyStateProps {
  headline: string;
  caption?: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function EmptyState({
  headline,
  caption,
  buttonLabel,
  onButtonPress,
  style,
  testID,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text
        numberOfLines={1}
        style={[
          styles.headline,
          {
            color: colors.text,
          },
        ]}
      >
        {headline}
      </Text>

      {caption ? (
        <Text
          numberOfLines={1}
          style={[
            styles.caption,
            {
              color: colors.textTertiary,
            },
          ]}
        >
          {caption}
        </Text>
      ) : null}

      {buttonLabel && onButtonPress ? (
        <View style={styles.buttonContainer}>
          <TextLinkButton label={buttonLabel} onPress={onButtonPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  headline: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    textAlign: 'center',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 8,
  },
});
