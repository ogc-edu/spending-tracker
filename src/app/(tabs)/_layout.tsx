import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/theme';
import { ActivityIndicator, View } from 'react-native';

/**
 * Tabs gate — unreachable while signed out (plan 003 gate).
 * AuthProvider already guarantees status !== loading by the time this
 * layout mounts (RootStack renders this only after DB ready, and the
 * provider's initial effect resolves to signedOut|signedIn). If auth is
 * signedOut we push the user to /login; the login screen's own redirect
 * brings them back after auth.
 */
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

const tabIcon = (name: React.ComponentProps<typeof Ionicons>['name']) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  };

export default function TabLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (status === 'signedOut') {
    return <Redirect href={"/login" as never} />;
  }

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
