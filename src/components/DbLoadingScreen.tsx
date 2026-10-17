import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { geistWeights, useTheme } from '@/theme';

/** Shown while the database initializes or recovers. */
export function DbLoadingScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.brandIconWrap, { backgroundColor: colors.surface }]}>
        <Ionicons name="wallet-outline" size={32} color={colors.accent} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Spending Tracker</Text>
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Preparing your finances…
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brandIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    letterSpacing: -0.4,
    marginBottom: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  note: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: geistWeights.medium,
  },
});