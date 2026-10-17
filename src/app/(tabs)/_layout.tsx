import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { TabBar } from '@/components/ui/TabBar';
import { useTheme } from '@/theme';

export default function TabLayout() {
  const { status } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  if (status === 'loading') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (status === 'signedOut') {
    return <Redirect href={"/login" as never} />;
  }

  return (
    <Tabs
      tabBar={(props) => {
        const currentRoute = props.state.routes[props.state.index]?.name ?? 'index';
        return (
          <TabBar
            currentRoute={currentRoute}
            onNavigate={(route) => {
              props.navigation.navigate(route);
            }}
            onActionPress={() => {
              router.push('/expenses/new' as never);
            }}
            testID="main-tab-bar"
          />
        );
      }}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
        }}
      />
      <Tabs.Screen
        name="commitments"
        options={{
          title: 'Due',
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
        }}
      />
      {/* Settings is not a tab — opened from Home header gear. Route registered with href: null */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
