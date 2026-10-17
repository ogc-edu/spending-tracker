import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';
import { CategoryTile } from './CategoryTile';

export interface ExpenseRowProps {
  categoryIndex?: number;
  categoryName?: string;
  note?: string;
  meta: string;
  amount: string;
  isLast?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ExpenseRow({
  categoryIndex,
  categoryName,
  note,
  meta,
  amount,
  isLast = false,
  onPress,
  style,
  testID,
}: ExpenseRowProps) {
  const { colors } = useTheme();

  const title = (note && note.trim().length > 0) ? note : (categoryName ?? 'Expense');

  const content = (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomColor: colors.separator, borderBottomWidth: 1 },
        style,
      ]}
      testID={testID}
    >
      <CategoryTile categoryIndex={categoryIndex} name={categoryName} />

      <View style={styles.middle}>
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
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
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
  title: {
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
});
