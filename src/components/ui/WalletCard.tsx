import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  accountCards,
  geistWeights,
  onCard,
  tabularNumsVariant,
  useTheme,
} from '@/theme';
import type { AccountCardType } from './AccountSwatch';

export interface WalletCardLine {
  label: string;
  value: string;
}

export interface WalletCardProps {
  id: string;
  name: string;
  kind: string;
  amount: string;
  amountLabel: string; // 'Balance' | 'Owed'
  accountType: AccountCardType;
  lines?: readonly WalletCardLine[] | WalletCardLine[];
  isOpen: boolean;
  onToggle: () => void;
  index?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const COLLAPSED_HEIGHT = 76;
const EXPANDED_HEIGHT = 172;
const ANIMATION_DURATION = 220;

export function WalletCard({
  id,
  name,
  kind,
  amount,
  amountLabel,
  accountType,
  lines = [],
  isOpen,
  onToggle,
  index = 0,
  style,
  testID,
}: WalletCardProps) {
  const { scheme, colors } = useTheme();

  const cardBg =
    accountCards[accountType]?.[scheme] ??
    accountCards[accountType]?.dark ??
    accountCards.bank[scheme];

  const heightValue = useSharedValue(isOpen ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT);

  useEffect(() => {
    heightValue.value = withTiming(isOpen ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.ease),
    });
  }, [isOpen, heightValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightValue.value,
  }));

  const isDark = scheme === 'dark';

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          marginTop: index === 0 ? 0 : -18,
          zIndex: index + 1,
          backgroundColor: cardBg,
          shadowColor: colors.bg,
          shadowOffset: { width: 0, height: isDark ? -6 : -4 },
          shadowOpacity: isDark ? 0.55 : 0.12,
          shadowRadius: isDark ? 14 : 12,
          elevation: isDark ? 6 : 4,
        },
        animatedStyle,
        style,
      ]}
      testID={testID}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${kind}, ${amount} ${amountLabel}`}
        accessibilityState={{ expanded: isOpen }}
        style={styles.pressable}
      >
        {/* Top summary row */}
        <View style={styles.topRow}>
          <View style={styles.left}>
            <Text
              numberOfLines={1}
              style={[styles.name, { color: onCard.text }]}
            >
              {name}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.kind,
                { color: onCard.text, opacity: onCard.textSoftOpacity },
              ]}
            >
              {kind}
            </Text>
          </View>

          <View style={styles.right}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[styles.amount, { color: onCard.text }]}
            >
              {amount}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.amountLabel,
                { color: onCard.text, opacity: onCard.textSoftOpacity },
              ]}
            >
              {amountLabel}
            </Text>
          </View>
        </View>

        {/* Expanded detail lines */}
        {isOpen && lines.length > 0 ? (
          <View
            style={[
              styles.detailsArea,
              { borderTopColor: onCard.hairline },
            ]}
          >
            {lines.slice(0, 3).map((line, idx) => (
              <View key={`${id}-line-${idx}`} style={styles.detailLine}>
                <Text
                  numberOfLines={1}
                  style={[styles.lineLabel, { color: onCard.text }]}
                >
                  {line.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.lineValue, { color: onCard.text }]}
                >
                  {line.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  pressable: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  right: {
    alignItems: 'flex-end',
  },
  name: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  kind: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginTop: 1,
  },
  amount: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
  },
  amountLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginTop: 1,
  },
  detailsArea: {
    marginTop: 14,
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  lineLabel: {
    fontSize: 13,
    lineHeight: 17,
    opacity: 0.9,
    flex: 1,
  },
  lineValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
  },
});
