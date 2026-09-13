import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/theme';
import { ActivityIndicator, Platform, View, type ColorValue } from 'react-native';

/**
 * Tabs gate — unreachable while signed out (plan 003 gate).
 * AuthProvider already guarantees status !== loading by the time this
 * layout mounts (RootStack renders this only after DB ready, and the
 * provider's initial effect resolves to signedOut|signedIn). If auth is
 * signedOut we push the user to /login; the login screen's own redirect
 * brings them back after auth.
 */
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcon = (activeName: IconName, inactiveName: IconName) =>
  function TabIcon({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <Ionicons name={focused ? activeName : inactiveName} size={size} color={color} />;
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
        tabBarInactiveTintColor: colors.muted,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 26 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarLabel: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="expenses" options={{ title: 'Expenses', tabBarIcon: tabIcon('receipt', 'receipt-outline') }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets', tabBarIcon: tabIcon('pie-chart', 'pie-chart-outline') }} />
      {/* "Commitments" truncates on narrow screens — the short tab label keeps
          the domain term in the header title (plan 017). */}
      <Tabs.Screen name="commitments" options={{ title: 'Commitments', tabBarLabel: 'Recurring', tabBarIcon: tabIcon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: tabIcon('stats-chart', 'stats-chart-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
