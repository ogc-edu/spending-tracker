import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category, Expense } from '@/db/schema';
import { CashFlowService, type CashFlowSnapshot } from '@/services/CashFlowService';
import { CategoryService } from '@/services/CategoryService';
import { AccountService } from '@/services/AccountService';
import { CreditBillService } from '@/services/CreditBillService';
import { AiConfigService, aiServiceOptions } from '@/services/AiConfigService';
import { toAskSnapshot } from '@/services/toAskSnapshot';
import { createAIService } from '@/ai/AIService';
import { AIUnavailableError, toAIError } from '@/ai/errors';
import type { AIResult, AskSnapshot } from '@/ai/types';
import type { CreditBill } from '@/engine/creditBills';
import { daysInMonth, toLocalDateString } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { geistWeights, useTheme } from '@/theme';

import { DueRow } from '@/components/ui/DueRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenTitleBlock } from '@/components/ui/ScreenTitleBlock';
import { SummaryStrip } from '@/components/ui/SummaryStrip';
import { TextLinkButton } from '@/components/ui/TextLinkButton';
import { WalletStack, type WalletCardData } from '@/components/ui/WalletStack';
import type { WalletCardLine } from '@/components/ui/WalletCard';
import type { AccountCardType } from '@/components/ui/AccountSwatch';
import { AskAiSheet } from '@/components/dashboard/AskAiSheet';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_SHORT = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const NOOP_RETRY = (): void => {};

function useSafeInsets() {
  try {
    return useSafeAreaInsets();
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

export default function HomeScreen() {
  const { authService } = useAuth();
  const router = useRouter();
  const insets = useSafeInsets();
  const { colors } = useTheme();

  const services = useMemo(() => {
    const repos = repositories();
    return {
      cashflow: new CashFlowService(
        repos.accounts,
        repos.expenses,
        repos.commitments,
        authService,
        repos.creditBills,
      ),
      categories: new CategoryService(repos.categories),
      accounts: new AccountService(repos.accounts, authService),
      creditBills: repos.creditBills
        ? new CreditBillService(
            repos.accounts,
            repos.expenses,
            repos.creditBills,
            authService,
          )
        : null,
      aiConfig: new AiConfigService(repos.settings, authService),
      repos,
    };
  }, [authService]);

  const aiService = useMemo(
    () => createAIService('fake', {}, aiServiceOptions(services.aiConfig)),
    [services.aiConfig],
  );

  const [snapshot, setSnapshot] = useState<CashFlowSnapshot | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountExpenses, setAccountExpenses] = useState<Map<number, Expense[]>>(new Map());
  const [accountBills, setAccountBills] = useState<Map<number, CreditBill[]>>(new Map());
  const [monthlyExpenseCount, setMonthlyExpenseCount] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiSheetVisible, setAiSheetVisible] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<AIUnavailableError | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [aiPayload, setAiPayload] = useState<AskSnapshot | null>(null);
  const aiBusyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const now = new Date();
      const todayStr = toLocalDateString(now);
      const user = await authService.currentUser();
      const userId = user?.id ?? 1;

      const [snap, cats, accs, monthExpenses] = await Promise.all([
        services.cashflow.snapshot(now),
        services.categories.list(),
        services.accounts.list(),
        services.repos.expenses.listForMonth(userId, now.getFullYear(), now.getMonth() + 1),
      ]);

      setSnapshot(snap);
      setCategories(cats);
      setAccounts(accs);
      setMonthlyExpenseCount(monthExpenses.length);

      // Load recent expenses for liquid accounts and bills for credit accounts
      const expensesMap = new Map<number, Expense[]>();
      const billsMap = new Map<number, CreditBill[]>();

      await Promise.all(
        accs.map(async (acc) => {
          if (acc.type === 'credit_card' || acc.type === 'paylater') {
            if (services.creditBills) {
              try {
                const bills = await services.creditBills.listBillsForAccount(acc.id, todayStr);
                billsMap.set(acc.id, bills);
              } catch {
                billsMap.set(acc.id, []);
              }
            }
          } else {
            try {
              const recent = await services.repos.expenses.query(userId, {
                accountId: acc.id,
                limit: 3,
              });
              expensesMap.set(acc.id, recent);
            } catch {
              expensesMap.set(acc.id, []);
            }
          }
        }),
      );

      setAccountExpenses(expensesMap);
      setAccountBills(billsMap);
      setError(null);
    } catch (loadError: unknown) {
      setError(errMsg(loadError));
    } finally {
      setLoading(false);
    }
  }, [services, authService]);

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

  const runAsk = useCallback(
    async (question: string, payload: AskSnapshot) => {
      if (aiBusyRef.current) return;
      aiBusyRef.current = true;
      setAiPending(true);
      setAiError(null);
      setAiResult(null);
      setAiQuestion(question);
      setAiPayload(payload);
      try {
        const result = await aiService.analyze('ask', payload, { question });
        setAiResult(result);
      } catch (err: unknown) {
        setAiError(toAIError(err));
      } finally {
        aiBusyRef.current = false;
        setAiPending(false);
      }
    },
    [aiService],
  );

  const onAsk = useCallback(
    (question: string) => {
      if (!snapshot) return;
      void runAsk(question, toAskSnapshot(snapshot, categories));
    },
    [snapshot, categories, runAsk],
  );

  const onAskRetry = useCallback(() => {
    if (aiQuestion && aiPayload) void runAsk(aiQuestion, aiPayload);
  }, [aiQuestion, aiPayload, runAsk]);

  const aiState = useMemo(
    () => ({
      pending: aiPending,
      error: aiError,
      result: aiResult,
      onRetry: aiError ? onAskRetry : NOOP_RETRY,
    }),
    [aiPending, aiError, aiResult, onAskRetry],
  );

  const now = new Date();
  const dateCaption = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]}`;
  const monthTitle = MONTH_NAMES[now.getMonth()] ?? 'Home';

  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>();
    for (const c of categories) {
      map.set(c.id, c);
    }
    return map;
  }, [categories]);

  // Account card builder
  const walletCards: WalletCardData[] = useMemo(() => {
    return accounts.map((acc) => {
      const isCredit = acc.type === 'credit_card' || acc.type === 'paylater';

      let kindLabel = 'Account';
      if (acc.type === 'bank') kindLabel = 'Bank';
      else if (acc.type === 'cash') kindLabel = 'Wallet';
      else if (acc.type === 'ewallet') kindLabel = 'E-wallet';
      else if (acc.type === 'credit_card') {
        if (acc.statementDay && acc.dueDay) {
          kindLabel = `Statement ${ordinal(acc.statementDay)} · due ${ordinal(acc.dueDay)}`;
        } else {
          kindLabel = 'Credit card';
        }
      } else if (acc.type === 'paylater') {
        if (acc.statementDay) {
          kindLabel = `Pay later · closes ${ordinal(acc.statementDay)}`;
        } else {
          kindLabel = 'Pay later';
        }
      }

      const lines: WalletCardLine[] = [];

      if (!isCredit) {
        const exps = accountExpenses.get(acc.id) ?? [];
        for (const exp of exps) {
          const [, em, ed] = exp.date.split('-').map(Number);
          const shortMonth = MONTH_NAMES[(em ?? 1) - 1]?.slice(0, 3) ?? 'M';
          const cat = exp.categoryId ? categoryMap.get(exp.categoryId)?.name : null;
          const noteText = exp.description ? exp.description : cat ?? 'Expense';
          lines.push({
            label: `${ed} ${shortMonth} · ${noteText}`,
            value: `−${formatSen(exp.amountSen)}`,
          });
        }
      } else {
        const bills = accountBills.get(acc.id) ?? [];
        if (acc.statementDay == null || acc.dueDay == null) {
          lines.push({
            label: 'Set billing cycle',
            value: `Statement ${acc.statementDay ?? '—'} · Due ${acc.dueDay ?? '—'}`,
          });
        } else {
          const closedUnpaid = bills.filter(
            (b) => b.status === 'unpaid' && b.outstandingSen > 0,
          );
          const openBill = bills.find((b) => b.status === 'open');

          if (closedUnpaid.length > 0) {
            const b = closedUnpaid[0]!;
            const [, cm, cd] = b.closeDate.split('-').map(Number);
            const [, dm, dd] = b.dueDate.split('-').map(Number);
            const closeM = MONTH_NAMES[(cm ?? 1) - 1]?.slice(0, 3) ?? 'M';
            const dueM = MONTH_NAMES[(dm ?? 1) - 1]?.slice(0, 3) ?? 'M';
            lines.push({
              label: `${b.label} · closed ${cd} ${closeM}`,
              value: formatSen(b.outstandingSen),
            });
            lines.push({
              label: 'Due',
              value: `${dd} ${dueM}`,
            });
          }
          if (openBill) {
            lines.push({
              label: `${openBill.label} · open`,
              value: formatSen(openBill.amountSen),
            });
          }
        }
      }

      return {
        id: String(acc.id),
        name: acc.name,
        kind: kindLabel,
        amount: formatSen(acc.balanceSen),
        amountLabel: isCredit ? 'Owed' : 'Balance',
        accountType: acc.type as AccountCardType,
        lines,
      };
    });
  }, [accounts, accountExpenses, accountBills, categoryMap]);

  if (!snapshot && loading) {
    return (
      <View style={[styles.screen, styles.centerBox, { backgroundColor: colors.bg }]} testID="dashboard-loading" />
    );
  }

  const endDay = snapshot
    ? daysInMonth(snapshot.month.year, snapshot.month.month)
    : 31;
  const shortMonth = snapshot
    ? MONTH_NAMES[snapshot.month.month - 1]?.slice(0, 3)
    : 'Month';
  const dueByLabel = `Due by ${endDay} ${shortMonth}`;

  const topUpcoming = (snapshot?.upcomingItems ?? []).slice(0, 5);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]} testID="dashboard-screen">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 72,
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
        {/* Title Block */}
        <ScreenTitleBlock
          caption={dateCaption}
          title={monthTitle}
          right={
            <>
              <IconButton
                glyph="ai"
                onPress={() => setAiSheetVisible(true)}
                accessibilityLabel="Ask AI"
                testID="home-ai-button"
              />
              <IconButton
                glyph="settings"
                onPress={() => router.push('/settings' as never)}
                accessibilityLabel="Settings"
                testID="dashboard-settings"
              />
            </>
          }
          testID="home-title-block"
        />

        <View style={styles.body}>
          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]} testID="dashboard-error">
              {error}
            </Text>
          ) : null}

          {snapshot && snapshot.accountCount === 0 ? (
            <EmptyState
              headline="No accounts yet"
              caption="Add an account to start tracking your spending and commitments."
              buttonLabel="Create an account"
              onButtonPress={() => router.navigate('/settings' as never)}
              testID="dashboard-empty-accounts"
            />
          ) : (
            <>
              {/* Summary Strip */}
              {snapshot ? (
                <SummaryStrip
                  spentLabel="Spent this month"
                  spentAmount={formatSen(snapshot.spentSen)}
                  spentMeta={`${monthlyExpenseCount} ${
                    monthlyExpenseCount === 1 ? 'expense' : 'expenses'
                  }`}
                  dueLabel={dueByLabel}
                  dueAmount={formatSen(snapshot.upcomingSen)}
                  dueMeta={`${snapshot.upcomingItems.length} to pay`}
                  testID="home-summary-strip"
                />
              ) : null}

              {/* Accounts Wallet Stack */}
              <WalletStack
                cards={walletCards}
                availableAmount={
                  snapshot ? formatSen(snapshot.availableSen) : undefined
                }
                headerTitle="Accounts"
                testID="home-wallet-stack"
              />

              {/* Due section */}
              <View style={styles.dueSection}>
                <View style={styles.dueHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {dueByLabel}
                  </Text>
                  <TextLinkButton
                    label="See all"
                    onPress={() => router.navigate('/commitments' as never)}
                    testID="home-due-see-all"
                  />
                </View>

                {topUpcoming.length === 0 ? (
                  <Text style={[styles.emptyDueText, { color: colors.textTertiary }]}>
                    No upcoming commitments or credit bills due this month.
                  </Text>
                ) : (
                  <View style={styles.dueList}>
                    {topUpcoming.map((item, index) => {
                      const [, im, id] = item.dueDate.split('-').map(Number);
                      const itemMonth = MONTH_SHORT[(im ?? 1) - 1] ?? 'OCT';
                      const isLast = index === topUpcoming.length - 1;

                      let metaText = item.frequency === 'monthly' ? 'Monthly' : 'One-time';
                      if (item.kind === 'credit_bill') {
                        metaText = 'Credit bill';
                      }

                      return (
                        <DueRow
                          key={`${item.commitmentId}-${item.dueDate}-${index}`}
                          day={id ?? 1}
                          month={itemMonth}
                          name={item.name}
                          meta={metaText}
                          amount={formatSen(item.amountSen)}
                          isLast={isLast}
                          onPress={() => {
                            if (item.kind === 'credit_bill') {
                              router.navigate('/commitments' as never);
                            } else {
                              router.push(`/commitments/${item.commitmentId}` as never);
                            }
                          }}
                          testID={`upcoming-row-${item.commitmentId}`}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Ask AI Sheet */}
      <AskAiSheet
        visible={aiSheetVisible}
        onClose={() => setAiSheetVisible(false)}
        ai={aiState}
        label={aiQuestion ? `You asked: ${aiQuestion}` : null}
        onSubmit={onAsk}
        disabled={snapshot === null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 20,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: geistWeights.medium,
  },
  dueSection: {
    gap: 10,
  },
  dueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  emptyDueText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: geistWeights.medium,
    paddingVertical: 12,
  },
  dueList: {
    flexDirection: 'column',
  },
});
