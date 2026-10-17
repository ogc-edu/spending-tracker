import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { geistWeights, useTheme } from '@/theme';
import { Glyph, type GlyphName } from './Glyph';

export interface TabItem {
  route: string;
  label: string;
  glyph: GlyphName;
}

export const TAB_ITEMS: readonly TabItem[] = [
  { route: 'index', label: 'Home', glyph: 'home' },
  { route: 'expenses', label: 'Expenses', glyph: 'expenses' },
  { route: 'commitments', label: 'Due', glyph: 'due' },
  { route: 'analytics', label: 'Analytics', glyph: 'analytics' },
] as const;

export interface TabBarProps {
  currentRoute?: string;
  onNavigate: (route: string) => void;
  onActionPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function TabBar({
  currentRoute = 'index',
  onNavigate,
  onActionPress,
  style,
  testID,
}: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const isTabActive = (route: string) => {
    if (!currentRoute) return false;
    return currentRoute === route || currentRoute.endsWith(`/${route}`);
  };

  const renderTab = (item: TabItem) => {
    const active = isTabActive(item.route);
    const color = active ? colors.text : colors.textTertiary;

    return (
      <Pressable
        key={item.route}
        onPress={() => onNavigate(item.route)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.label}
        testID={testID ? `${testID}-tab-${item.route}` : undefined}
        style={styles.tabButton}
      >
        <Glyph name={item.glyph} size={22} color={color} strokeWidth={1.8} />
        <Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            {
              color,
              fontFamily: active ? geistWeights.semiBold : geistWeights.medium,
              fontWeight: active ? '600' : '500',
            },
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.tabbar,
          borderTopColor: colors.separator,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 64 + Math.max(insets.bottom, 8),
        },
        style,
      ]}
      testID={testID}
    >
      {/* 1. Home */}
      {renderTab(TAB_ITEMS[0])}

      {/* 2. Expenses */}
      {renderTab(TAB_ITEMS[1])}

      {/* 3. Center Action Button (+) */}
      <View style={styles.actionColumn}>
        <TouchableOpacity
          onPress={onActionPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Add expense"
          testID={testID ? `${testID}-action-plus` : undefined}
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.accent,
            },
          ]}
        >
          <Glyph name="plus" size={24} color={colors.onAccent} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {/* 4. Due */}
      {renderTab(TAB_ITEMS[2])}

      {/* 5. Analytics */}
      {renderTab(TAB_ITEMS[3])}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 13,
    textAlign: 'center',
  },
  actionColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
