/**
 * FormulaCard (plan 010 DASH-3, redesigned Plan 003) — The Cash Flow Equation tile:
 * Liquid Available − Upcoming commitments − Remaining budget − Safety buffer = Safe.
 *
 * Plan 003 Bento redesign:
 * - Cash Flow Equation tile with testID="cashflow-formula-card" (and retaining formula-card, formula-toggle).
 * - Tapping the tile opens an accessible bottom sheet (Sheet.tsx) breaking down
 *   liquid balances, unpaid bills, budget reserve, and buffer.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CashFlowBreakdownItem } from '@/engine/cashflow';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { BentoCard } from '@/components/ui/BentoCard';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/utils';

export interface FormulaCardProps {
  /** Signed labelled terms from engine.cashFlowBreakdown (Σ = safeSen). */
  breakdown: CashFlowBreakdownItem[];
  safeSen: number;
}

export function FormulaCard({ breakdown, safeSen }: FormulaCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View testID="cashflow-formula-card" className="flex-1">
      <BentoCard testID="formula-card" className="p-4 border border-border/60 bg-card h-full justify-between">
        <Pressable
          onPress={() => setExpanded((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse the formula' : 'Expand the formula'}
          accessibilityState={{ expanded }}
          className="flex-1 min-h-[44px]"
          style={styles.header}
          testID="formula-toggle"
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="calculator-outline" size={14} color={colors.accent} />
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={styles.title}>
                Equation
              </Text>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.muted}
            />
          </View>

          <View className="my-1">
            <Text className="text-[11px] text-muted-foreground font-medium mb-1">
              Liquid − Bills − Reserve
            </Text>
            <MoneyDisplay
              amountInSen={safeSen}
              size="lg"
              className={cn(
                'font-mono font-black',
                safeSen < 0 ? 'text-destructive' : 'text-foreground'
              )}
            />
          </View>

          <Text className="text-[11px] text-primary font-semibold mt-2" style={styles.headerHint}>
            {expanded ? 'Tap to collapse' : 'Tap for breakdown'}
          </Text>
        </Pressable>

        {/* Accessible Cash Flow Breakdown Bottom Sheet */}
        <Sheet
          visible={expanded}
          onClose={() => setExpanded(false)}
          title="Cash Flow Breakdown"
          showClose
          closeLabel="Close cash flow breakdown"
          cardTestID="formula-sheet"
        >
          <Text className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Liquid balances − Unpaid bills − Monthly budget reserve − Safety buffer = Safe-to-Spend.
          </Text>

          <View style={styles.body} testID="formula-breakdown">
            {breakdown.map((item) => (
              <View
                key={item.label}
                className="flex-row justify-between items-center py-2.5 border-b border-border/40"
                style={styles.row}
                testID={`formula-row-${item.label}`}
              >
                <Text className="text-sm text-foreground font-medium" style={styles.rowLabel}>
                  {item.label}
                </Text>
                <Text
                  className={cn(
                    'text-sm font-bold font-mono',
                    item.amountSen < 0 ? 'text-destructive' : 'text-foreground'
                  )}
                  style={[
                    styles.rowAmount,
                    item.amountSen < 0 ? styles.minus : styles.plus,
                  ]}
                  numberOfLines={1}
                  accessibilityLabel={`${item.label}, ${spokenMoneyLabel(item.amountSen)}`}
                >
                  {formatSen(item.amountSen)}
                </Text>
              </View>
            ))}

            <View
              className="flex-row justify-between items-center pt-3.5 mt-1"
              style={styles.equalsRow}
              testID="formula-equals"
            >
              <Text className="text-base font-bold text-foreground" style={styles.equalsLabel}>
                Safe to spend
              </Text>
              <Text
                className={cn(
                  'text-base font-black font-mono',
                  safeSen < 0 ? 'text-destructive' : 'text-primary'
                )}
                style={styles.equalsAmount}
                numberOfLines={1}
                accessibilityLabel={`Safe to spend, ${spokenMoneyLabel(safeSen)}`}
              >
                {formatSen(safeSen)}
              </Text>
            </View>
          </View>
        </Sheet>
      </BentoCard>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {},
  title: { fontSize: typography.caption, fontWeight: '700', color: colors.muted },
  headerHint: { fontSize: typography.caption, color: colors.muted },
  body: {
    paddingTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowLabel: { fontSize: typography.body, color: colors.text, fontWeight: '500' },
  rowAmount: {
    fontSize: typography.body,
    fontWeight: '700',
    fontVariant: moneyFontVariant,
    flexShrink: 1,
    marginLeft: spacing.md,
  },
  plus: { color: colors.text },
  minus: { color: colors.danger },
  equalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  equalsLabel: { fontSize: typography.body, fontWeight: '700', color: colors.text },
  equalsAmount: {
    fontSize: typography.emphasis,
    fontWeight: '800',
    color: colors.accent,
    fontVariant: moneyFontVariant,
    flexShrink: 1,
    marginLeft: spacing.md,
  },
});