import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Category } from '@/db/schema';
import {
  AnalyticsService,
  type SeriesGranularity,
  type SpendingSeriesItem,
  type SpendingSeriesResult,
} from '@/services/AnalyticsService';
import { CategoryService } from '@/services/CategoryService';
import { todayLocal } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

import { BarChart, type BarChartItem } from '@/components/ui/BarChart';
import { BreakdownRow } from '@/components/ui/BreakdownRow';
import { Chip } from '@/components/ui/Chip';
import { Money } from '@/components/ui/Money';
import { ScreenTitleBlock } from '@/components/ui/ScreenTitleBlock';
import { SegmentedControl, type SegmentOption } from '@/components/ui/SegmentedControl';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const GRAIN_OPTIONS: readonly SegmentOption[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export function formatPeriodTitle(
  periodStart: string,
  granularity: SeriesGranularity,
): string {
  if (granularity === 'month') {
    const [y, m] = periodStart.split('-').map(Number);
    const shortM = SHORT_MONTHS[(m ?? 1) - 1] ?? '';
    return `${shortM} ${y}`;
  }
  if (granularity === 'week') {
    const [, m, d] = periodStart.split('-').map(Number);
    const shortM = SHORT_MONTHS[(m ?? 1) - 1] ?? '';
    return `Week of ${d} ${shortM}`;
  }
  const [, m, d] = periodStart.split('-').map(Number);
  const shortM = SHORT_MONTHS[(m ?? 1) - 1] ?? '';
  return `${d} ${shortM}`;
}

interface CategorySeriesData {
  category: Category;
  series: SpendingSeriesItem[];
}

export interface BreakdownItem {
  id: number;
  name: string;
  amountSen: number;
  pct: number;
}

function useSafeInsets() {
  try {
    return useSafeAreaInsets();
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

export default function AnalyticsScreen() {
  const { authService } = useAuth();
  const insets = useSafeInsets();
  const { colors } = useTheme();

  const services = useMemo(() => {
    const repos = repositories();
    return {
      analytics: new AnalyticsService(repos.expenses, repos.categories, authService),
      categories: new CategoryService(repos.categories),
    };
  }, [authService]);

  const [granularity, setGranularity] = useState<SeriesGranularity>('month');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [seriesResult, setSeriesResult] = useState<SpendingSeriesResult | null>(null);
  const [catSeriesList, setCatSeriesList] = useState<CategorySeriesData[]>([]);
  const [userSelectedBarIndex, setUserSelectedBarIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const today = todayLocal();
      const catList = await services.categories.list();
      setCategories(catList);

      const allResult = await services.analytics.spendingSeries({
        granularity,
        endDate: today,
        categoryId: selectedCategoryId ?? undefined,
      });
      setSeriesResult(allResult);

      if (selectedCategoryId === null) {
        const catResults = await Promise.all(
          catList.map(async (cat) => {
            const res = await services.analytics.spendingSeries({
              granularity,
              endDate: today,
              categoryId: cat.id,
            });
            return { category: cat, series: res.series };
          }),
        );
        setCatSeriesList(catResults);
      } else {
        setCatSeriesList([]);
      }
      setError(null);
    } catch (loadError: unknown) {
      setError(errMsg(loadError));
    } finally {
      setLoading(false);
    }
  }, [services, granularity, selectedCategoryId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleGrainChange = (value: string) => {
    setGranularity(value as SeriesGranularity);
    setUserSelectedBarIndex(null);
  };

  const handleSelectCategory = (catId: number | null) => {
    setSelectedCategoryId(catId);
    setUserSelectedBarIndex(null);
  };

  const series = useMemo(() => seriesResult?.series ?? [], [seriesResult]);
  const highestIndex = seriesResult?.highestIndex ?? 0;
  const activeBarIndex =
    userSelectedBarIndex !== null && userSelectedBarIndex < series.length
      ? userSelectedBarIndex
      : highestIndex < series.length
        ? highestIndex
        : 0;

  const selectedItem: SpendingSeriesItem | undefined = series[activeBarIndex];
  const selectedPeriodTitle = selectedItem
    ? formatPeriodTitle(selectedItem.periodStart, granularity)
    : '';
  const selectedPeriodTotalSen = selectedItem?.totalSen ?? 0;

  const highestItem: SpendingSeriesItem | undefined = series[highestIndex];
  const highestPeriodTitle = highestItem
    ? formatPeriodTitle(highestItem.periodStart, granularity)
    : '';
  const highestTotalSen = highestItem?.totalSen ?? 0;

  const averagePerPeriod = seriesResult?.averagePerPeriod ?? 0;

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === null) return null;
    return categories.find((c) => c.id === selectedCategoryId)?.name ?? null;
  }, [categories, selectedCategoryId]);

  const chartBars: BarChartItem[] = useMemo(() => {
    if (granularity === 'month') {
      return series.map((item) => ({
        label: item.label,
        valueSen: item.totalSen,
        a11yLabel: item.a11yLabel,
      }));
    }
    if (granularity === 'week') {
      return series.map((item, idx) => {
        const [, m, d] = item.periodStart.split('-').map(Number);
        const shortM = SHORT_MONTHS[(m ?? 1) - 1] ?? '';
        return {
          label: idx % 2 === 0 ? `${d} ${shortM}` : '',
          valueSen: item.totalSen,
          a11yLabel: item.a11yLabel,
        };
      });
    }
    // day
    return series.map((item, idx) => {
      const dayNum = String(Number(item.periodStart.split('-')[2]));
      return {
        label: idx % 5 === 0 ? dayNum : '',
        valueSen: item.totalSen,
        a11yLabel: item.a11yLabel,
      };
    });
  }, [series, granularity]);

  const breakdownItems: BreakdownItem[] = useMemo(() => {
    if (!series.length) return [];
    if (selectedCategoryId !== null) {
      if (!selectedCategoryName) return [];
      return [
        {
          id: selectedCategoryId,
          name: selectedCategoryName,
          amountSen: selectedPeriodTotalSen,
          pct: selectedPeriodTotalSen > 0 ? 100 : 0,
        },
      ];
    }

    const items: BreakdownItem[] = [];
    for (const { category, series: cSeries } of catSeriesList) {
      const catAmount = cSeries[activeBarIndex]?.totalSen ?? 0;
      if (catAmount > 0) {
        const pct =
          selectedPeriodTotalSen > 0
            ? Math.round((catAmount / selectedPeriodTotalSen) * 100)
            : 0;
        items.push({
          id: category.id,
          name: category.name,
          amountSen: catAmount,
          pct,
        });
      }
    }
    items.sort((a, b) => b.amountSen - a.amountSen);
    return items;
  }, [
    series.length,
    selectedCategoryId,
    selectedCategoryName,
    selectedPeriodTotalSen,
    catSeriesList,
    activeBarIndex,
  ]);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.bg }]}
      testID="analytics-screen"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 80,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.accent}
          />
        }
      >
        {/* Large Title */}
        <ScreenTitleBlock title="Analytics" testID="analytics-title" />

        {error ? (
          <View style={styles.errorContainer} testID="analytics-error">
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {/* Horizontal Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContent}
          style={styles.chipsScrollView}
          testID="analytics-category-chips"
        >
          <Chip
            label="All"
            selected={selectedCategoryId === null}
            onPress={() => handleSelectCategory(null)}
            testID="analytics-category-all"
          />
          {categories.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.name}
              selected={selectedCategoryId === cat.id}
              onPress={() => handleSelectCategory(cat.id)}
              testID={`analytics-category-${cat.id}`}
            />
          ))}
        </ScrollView>

        {/* SegmentedControl Day / Week / Month */}
        <View style={styles.segmentWrap}>
          <SegmentedControl
            options={GRAIN_OPTIONS}
            value={granularity}
            onChange={handleGrainChange}
            testID="analytics-grain-segmented"
          />
        </View>

        {loading && !seriesResult ? (
          <View style={styles.loadingBox} testID="analytics-loading">
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <>
            {/* Selected Period Header */}
            <View style={styles.periodHeaderRow}>
              <View style={styles.periodLeft}>
                <Text
                  numberOfLines={1}
                  style={[styles.periodCaption, { color: colors.textSecondary }]}
                  testID="analytics-period-title"
                >
                  {selectedPeriodTitle}
                  {selectedCategoryName ? ` · ${selectedCategoryName}` : ''}
                </Text>
                <Money
                  amountInSen={selectedPeriodTotalSen}
                  size="L"
                  testID="analytics-selected-amount"
                />
              </View>

              <View style={styles.periodRight}>
                <Text
                  numberOfLines={1}
                  style={[styles.avgLabel, { color: colors.textSecondary }]}
                  testID="analytics-avg-label"
                >
                  Average per {granularity}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.avgValue, { color: colors.text }]}
                  testID="analytics-avg-amount"
                >
                  {formatSen(averagePerPeriod)}
                </Text>
              </View>
            </View>

            {/* BarChart */}
            <View style={styles.chartSection}>
              <BarChart
                bars={chartBars}
                selectedIndex={activeBarIndex}
                onSelectBar={(idx) => setUserSelectedBarIndex(idx)}
                gap={granularity === 'day' ? 2 : 6}
                testID="analytics-barchart"
              />

              {/* Footnote */}
              <Text
                numberOfLines={1}
                style={[styles.footnote, { color: colors.textTertiary }]}
                testID="analytics-highest-footnote"
              >
                Highest:{' '}
                <Text
                  style={[
                    styles.footnoteEmphasis,
                    {
                      color: colors.emphasis,
                    },
                  ]}
                >
                  {highestPeriodTitle} · {formatSen(highestTotalSen)}
                </Text>
                {' '}· tap a bar to compare
              </Text>
            </View>

            {/* Breakdown section */}
            <View style={styles.breakdownSection} testID="analytics-breakdown-section">
              <Text
                numberOfLines={1}
                style={[styles.breakdownHeaderTitle, { color: colors.text }]}
                testID="analytics-breakdown-title"
              >
                Breakdown · {selectedPeriodTitle}
              </Text>

              {breakdownItems.length === 0 ? (
                <Text
                  numberOfLines={1}
                  style={[styles.emptyBreakdownText, { color: colors.textTertiary }]}
                  testID="analytics-breakdown-empty"
                >
                  No expenses for this period
                </Text>
              ) : (
                <View style={styles.breakdownList} testID="analytics-breakdown-list">
                  {breakdownItems.map((item, index) => (
                    <BreakdownRow
                      key={item.id}
                      name={item.name}
                      pct={item.pct}
                      amount={formatSen(item.amountSen)}
                      isLast={index === breakdownItems.length - 1}
                      testID={`analytics-breakdown-row-${item.id}`}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
  },
  errorContainer: {
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: geistWeights.medium,
  },
  chipsScrollView: {
    flexGrow: 0,
  },
  chipsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  segmentWrap: {
    paddingHorizontal: 16,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodHeaderRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  periodLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  periodCaption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  periodRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  avgLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontFamily: geistWeights.regular,
  },
  avgValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
  },
  chartSection: {
    paddingHorizontal: 16,
    gap: 10,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.regular,
  },
  footnoteEmphasis: {
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  breakdownSection: {
    paddingHorizontal: 16,
    gap: 4,
  },
  breakdownHeaderTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    marginVertical: 4,
  },
  breakdownList: {
    flexDirection: 'column',
  },
  emptyBreakdownText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: geistWeights.regular,
    paddingVertical: 12,
  },
});