import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { colors } from '@/theme';

const tabIcon = (name: React.ComponentProps<typeof Ionicons>['name']) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  };

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        headerTitleAlign: 'center',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen name="expenses" options={{ title: 'Expenses', tabBarIcon: tabIcon('receipt-outline') }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets', tabBarIcon: tabIcon('pie-chart-outline') }} />
      <Tabs.Screen name="commitments" options={{ title: 'Commitments', tabBarIcon: tabIcon('calendar-outline') }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: tabIcon('stats-chart-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings-outline') }} />
    </Tabs>
  );
}