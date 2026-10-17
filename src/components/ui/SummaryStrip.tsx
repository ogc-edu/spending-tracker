import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

export interface SummaryStripHomeProps {
  variant?: 'home';
  spentLabel?: string;
  spentAmount: string;
  spentMeta?: string;
  dueLabel?: string;
  dueAmount: string;
  dueMeta?: string;
  nextLabel?: never;
  nextAmount?: never;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface SummaryStripDueProps {
  variant: 'due';
  dueLabel?: string;
  dueAmount: string;
  nextLabel?: string;
  nextAmount?: string;
  spentLabel?: never;
  spentAmount?: never;
  spentMeta?: never;
  dueMeta?: never;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export type SummaryStripProps = SummaryStripHomeProps | SummaryStripDueProps;

export function SummaryStrip(props: SummaryStripProps) {
  const { colors } = useTheme();

  if (props.variant === 'due') {
    return (
      <View
        style={[
          styles.container,
          styles.dueContainer,
          { backgroundColor: colors.surface },
          props.style,
        ]}
        testID={props.testID}
      >
        <View style={styles.dueLeft}>
          <Text
            numberOfLines={1}
            style={[styles.caption, { color: colors.textSecondary }]}
          >
            {props.dueLabel ?? 'Due by end of month'}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[
              styles.amountM,
              { color: colors.emphasis },
            ]}
          >
            {props.dueAmount}
          </Text>
        </View>

        {props.nextAmount ? (
          <View style={styles.dueRight}>
            <Text
              numberOfLines={1}
              style={[styles.caption, { color: colors.textSecondary }]}
            >
              {props.nextLabel ?? 'Next month so far'}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[styles.amountS, { color: colors.text }]}
            >
              {props.nextAmount}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  // Home variant (2 columns)
  return (
    <View
      style={[
        styles.container,
        styles.homeContainer,
        { backgroundColor: colors.surface },
        props.style,
      ]}
      testID={props.testID}
    >
      <View style={styles.column}>
        <Text
          numberOfLines={1}
          style={[styles.caption, { color: colors.textSecondary }]}
        >
          {props.spentLabel ?? 'Spent this month'}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[styles.amountM, { color: colors.text }]}
        >
          {props.spentAmount}
        </Text>
        {props.spentMeta ? (
          <Text
            numberOfLines={1}
            style={[styles.caption, { color: colors.textTertiary }]}
          >
            {props.spentMeta}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.column,
          {
            borderLeftWidth: 1,
            borderLeftColor: colors.separatorStrong,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.caption, { color: colors.textSecondary }]}
        >
          {props.dueLabel ?? 'Due by end of month'}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[styles.amountM, { color: colors.emphasis }]}
        >
          {props.dueAmount}
        </Text>
        {props.dueMeta ? (
          <Text
            numberOfLines={1}
            style={[styles.caption, { color: colors.textTertiary }]}
          >
            {props.dueMeta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  homeContainer: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 2,
  },
  dueContainer: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dueRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  amountM: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
    letterSpacing: -0.22,
  },
  amountS: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
    textAlign: 'right',
  },
});
