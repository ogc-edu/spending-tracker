import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { geistWeights, useTheme } from '@/theme';

export interface BarChartItem {
  label: string;
  valueSen: number;
  a11yLabel?: string;
}

export interface BarChartProps {
  bars: readonly BarChartItem[] | BarChartItem[];
  selectedIndex?: number;
  onSelectBar?: (index: number) => void;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function BarChart({
  bars,
  selectedIndex,
  onSelectBar,
  gap = 6,
  style,
  testID,
}: BarChartProps) {
  const { colors } = useTheme();

  const maxIndex = useMemo(() => {
    if (!bars.length) return -1;
    let highestIdx = 0;
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].valueSen > bars[highestIdx].valueSen) {
        highestIdx = i;
      }
    }
    return highestIdx;
  }, [bars]);

  const activeIndex = selectedIndex !== undefined ? selectedIndex : maxIndex;

  const maxValue = useMemo(() => {
    if (!bars.length) return 1;
    const max = Math.max(...bars.map((b) => b.valueSen));
    return max > 0 ? max : 1;
  }, [bars]);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Bars row */}
      <View
        accessibilityRole="summary"
        accessibilityLabel="Spending chart"
        style={[
          styles.barsArea,
          {
            gap,
            borderBottomColor: colors.separatorStrong,
          },
        ]}
      >
        {bars.map((bar, index) => {
          const isSelected = index === activeIndex;
          const isHighest = index === maxIndex;

          const barColor = isSelected
            ? colors.chartActive
            : isHighest
              ? colors.chartMax
              : colors.chartIdle;

          const pct = Math.max(2, (bar.valueSen / maxValue) * 100);
          const a11y = bar.a11yLabel ?? `${bar.label}, RM${(bar.valueSen / 100).toFixed(2)}`;

          return (
            <Pressable
              key={`bar-${index}-${bar.label}`}
              onPress={() => onSelectBar?.(index)}
              accessibilityRole="button"
              accessibilityLabel={a11y}
              accessibilityState={{ selected: isSelected }}
              testID={testID ? `${testID}-bar-${index}` : undefined}
              style={styles.barColumn}
            >
              <View style={[styles.barWrapper, { height: `${pct}%` }]}>
                <Svg width="100%" height="100%" preserveAspectRatio="none">
                  <Rect
                    x={0}
                    y={0}
                    width="100%"
                    height="100%"
                    rx={4}
                    ry={1}
                    fill={barColor}
                  />
                </Svg>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Labels row */}
      <View style={[styles.labelsRow, { gap }]}>
        {bars.map((bar, index) => {
          const isSelected = index === activeIndex;
          return (
            <Text
              key={`label-${index}-${bar.label}`}
              numberOfLines={1}
              style={[
                styles.axisLabel,
                {
                  color: isSelected ? colors.text : colors.textTertiary,
                },
              ]}
            >
              {bar.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barsArea: {
    height: 168,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    minWidth: 0,
    justifyContent: 'flex-end',
  },
  barWrapper: {
    width: '100%',
    minHeight: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  axisLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
    textAlign: 'center',
  },
});
