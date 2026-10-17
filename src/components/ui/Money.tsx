import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { geistWeights, tabularNumsVariant, typeScale, useTheme } from '@/theme';
import { spokenMoneyLabel } from '@/utils/money';

export type MoneySize = 'hero' | 'sheet' | 'L' | 'M' | 'S' | 'body' | 'caption';

export interface MoneyProps {
  amountInSen?: number;
  formatted?: string;
  size?: MoneySize;
  emphasis?: boolean;
  dimCents?: boolean;
  color?: string;
  prefix?: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

const SCALE_MAP: Record<MoneySize, keyof typeof typeScale> = {
  hero: 'amountHero',
  sheet: 'amountSheet',
  L: 'amountL',
  M: 'amountM',
  S: 'amountS',
  body: 'body',
  caption: 'caption',
};

export function Money({
  amountInSen,
  formatted,
  size = 'body',
  emphasis = false,
  dimCents = false,
  color,
  prefix = 'RM',
  style,
  accessibilityLabel,
  testID,
}: MoneyProps) {
  const { colors } = useTheme();

  let sign = '';
  let ringgitStr = '0';
  let centsStr = '00';

  if (typeof amountInSen === 'number') {
    const absSen = Math.abs(amountInSen);
    ringgitStr = Math.floor(absSen / 100).toLocaleString('en-MY');
    centsStr = (absSen % 100).toString().padStart(2, '0');
    if (amountInSen < 0) {
      sign = '-';
    }
  }

  const scaleKey = SCALE_MAP[size] ?? 'body';
  const scale = typeScale[scaleKey];

  const textColor = color ?? (emphasis ? colors.emphasis : colors.text);
  const a11y =
    accessibilityLabel ??
    (typeof amountInSen === 'number' ? spokenMoneyLabel(amountInSen) : formatted);

  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      accessibilityLabel={a11y}
      testID={testID}
      style={[
        styles.text,
        {
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          fontWeight: scale.fontWeight,
          fontFamily: scale.fontFamily ?? geistWeights.semiBold,
          letterSpacing: scale.letterSpacing,
          color: textColor,
        },
        style,
      ]}
    >
      {formatted ? (
        formatted
      ) : (
        <>
          {sign}
          {prefix}
          {ringgitStr}
          {dimCents ? (
            <Text
              style={{ opacity: 0.6 }}
              testID={testID ? `${testID}-cents` : undefined}
            >
              .{centsStr}
            </Text>
          ) : (
            `.${centsStr}`
          )}
        </>
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontVariant: tabularNumsVariant,
  },
});
