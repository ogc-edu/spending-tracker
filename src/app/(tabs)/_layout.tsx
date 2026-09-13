import { Redirect, Tabs, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { ActivityIndicator, Platform, View, type ColorValue } from 'react-native';
import { colors, spacing } from '@/theme';

/**
 * Tabs gate — unreachable while signed out (plan 003 gate).
 * AuthProvider already guarantees status !== loading by the time this
 * layout mounts (RootStack renders this only after DB ready, and the
 * provider's initial effect resolves to signedOut|signedIn). If auth is
 * signedOut we push the user to /login; the login screen's own redirect
 * brings them back after auth.
 *
 * Plan 018 — five tabs: Settings is no longer a tab (it is a daily-adjacent
 * surface, not a daily one); the Dashboard header's gear opens it. The
 * `settings` route stays registered (`href: null`) so `/settings` deep
 * links and pushes keep working. With five slots the Commitments label is
 * back to the full domain term.
 */
import { Ionicons } from '@expo/vector-icons';
import { IconButton } from '@/components/ui/IconButton';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcon = (activeName: IconName, inactiveName: IconName) =>
  function TabIcon({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <Ionicons name={focused ? activeName : inactiveName} size={size} color={color} />;
  };

export default function TabLayout() {
  const { status } = useAuth();
  const router = useRouter();

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
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: tabIcon('home', 'home-outline'),
          headerRight: () => (
            <View style={{ marginRight: spacing.md }}>
              <IconButton
                icon="settings-outline"
                label="Open Settings"
                onPress={() => router.push('/settings' as never)}
                testID="dashboard-settings"
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="expenses" options={{ title: 'Expenses', tabBarIcon: tabIcon('receipt', 'receipt-outline') }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets', tabBarIcon: tabIcon('pie-chart', 'pie-chart-outline') }} />
      <Tabs.Screen name="commitments" options={{ title: 'Commitments', tabBarIcon: tabIcon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: tabIcon('stats-chart', 'stats-chart-outline') }} />
      {/* Settings lives off the tab bar (plan 018) — still routable via the
          Dashboard header gear, deep links, and pushes. */}
      <Tabs.Screen name="settings" options={{ href: null, tabBarIcon: tabIcon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
