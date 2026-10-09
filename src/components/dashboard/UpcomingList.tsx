/**
 * UpcomingList (plan 010 DASH-1/10, redesigned Plan 003) — Upcoming commitments countdown tile:
 * Next 2 maturing bills with countdown chips, quick-settle trigger,
 * and a total due before next month line.
 *
 * Plan 003 Bento redesign:
 * - Upcoming commitments countdown tile with testID="upcoming-bills-card"
 *   (and retaining upcoming-card, upcoming-empty, upcoming-total, upcoming-row-{item.commitmentId}).
 * - Next 2 maturing bills with countdown chips and quick-settle trigger.
 * - Overdue rows show the Overdue badge and danger styling.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UpcomingSnapshotItem } from '@/services/CashFlowService';
import { formatDayLabel, todayLocal } from '@/utils/dates';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, typography } from '@/theme';
import { Badge } from '@/components/ui/Badge';
import { BentoCard } from '@/components/ui/BentoCard';
import { cn } from '@/lib/utils';

export interface UpcomingListProps {
  /** Unpaid slots, due-date ascending — show up to 2 in the bento tile. */
  items: UpcomingSnapshotItem[];
  /** Σ of every item — the "total due" line. */
  totalSen: number;
  /** e.g. "01 Oct" — derived from next-month start by the screen. */
  dueBeforeLabel: string;
  /** Navigates to or triggers commitment settlement. */
  onOpenCommitment(commitmentId: number): void;
}

export function UpcomingList({
  items,
  totalSen,
  dueBeforeLabel,
  onOpenCommitment,
}: UpcomingListProps) {
  const today = todayLocal();

  return (
    <View testID="upcoming-bills-card" className="flex-1">
      <BentoCard testID="upcoming-card" className="p-4 border border-border/60 bg-card h-full justify-between">
        <View className="flex-1">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={styles.title}>
                Commitments
              </Text>
            </View>
            {items.length > 0 && (
              <Text className="text-[10px] font-bold text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full">
                {items.length} due
              </Text>
            )}
          </View>

          {/* List or Empty State */}
          {items.length === 0 ? (
            <View className="py-3 items-center justify-center">
              <Text
                className="text-xs text-muted-foreground font-medium text-center"
                style={styles.empty}
                testID="upcoming-empty"
              >
                Nothing due before next month
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {items.slice(0, 2).map((item) => {
                const isOverdue = item.dueDate < today;
                const dueTime = new Date(item.dueDate + 'T00:00:00').getTime();
                const todayTime = new Date(today + 'T00:00:00').getTime();
                const diffDays = Math.round((dueTime - todayTime) / (1000 * 60 * 60 * 24));

                let countdownText = `${diffDays}d`;
                if (diffDays === 0) countdownText = 'Today';
                else if (diffDays === 1) countdownText = 'Tomorrow';
                else if (diffDays > 1) countdownText = `in ${diffDays}d`;

                return (
                  <Pressable
                    key={`${item.commitmentId}:${item.dueDate}`}
                    onPress={() => onOpenCommitment(item.commitmentId)}
                    className={cn(
                      'flex-row items-center justify-between py-2 px-2.5 rounded-xl border min-h-[44px]',
                      isOverdue
                        ? 'bg-destructive/10 border-destructive/30'
                        : 'bg-muted/20 border-border/40'
                    )}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, due ${formatDayLabel(item.dueDate)}, ${spokenMoneyLabel(item.amountSen)}`}
                    testID={`upcoming-row-${item.commitmentId}`}
                  >
                    <View className="flex-1 mr-2" style={styles.rowMain}>
                      <Text
                        className="text-xs font-bold text-foreground"
                        style={styles.name}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <View className="flex-row items-center gap-1.5 mt-0.5" style={styles.dateRow}>
                        {isOverdue ? (
                          <Badge tone="danger" label="Overdue" />
                        ) : (
                          <Text className="text-[10px] font-semibold text-muted-foreground">
                            {countdownText}
                          </Text>
                        )}
                        <Text
                          className={cn(
                            'text-[10px]',
                            isOverdue
                              ? 'text-destructive font-semibold'
                              : 'text-muted-foreground font-medium'
                          )}
                          style={[styles.date, isOverdue && styles.dateOverdue]}
                        >
                          {formatDayLabel(item.dueDate)}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                      <Text
                        className={cn(
                          'text-xs font-bold font-mono',
                          isOverdue ? 'text-destructive' : 'text-foreground'
                        )}
                        style={[styles.amount, isOverdue && styles.amountOverdue]}
                        numberOfLines={1}
                        accessibilityLabel={`${item.name}, ${spokenMoneyLabel(item.amountSen)}`}
                      >
                        {formatSen(item.amountSen)}
                      </Text>
                      {/* Quick-settle trigger */}
                      <Pressable
                        onPress={() => onOpenCommitment(item.commitmentId)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Quick settle ${item.name}`}
                        testID={`upcoming-settle-${item.commitmentId}`}
                        className="w-6 h-6 rounded-full bg-primary/10 items-center justify-center ml-0.5"
                      >
                        <Ionicons name="checkmark-sharp" size={13} color={colors.primary} />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Total due line */}
        <View
          className="flex-row justify-between items-center border-t border-border/40 mt-2.5 pt-2"
          style={styles.footer}
          testID="upcoming-total"
        >
          <Text className="text-[11px] text-muted-foreground font-medium" style={styles.footerLabel}>
            Due before {dueBeforeLabel}
          </Text>
          <Text
            className="text-xs font-extrabold font-mono text-foreground"
            style={styles.footerAmount}
            numberOfLines={1}
            accessibilityLabel={`Due before ${dueBeforeLabel}, ${spokenMoneyLabel(totalSen)}`}
          >
            {formatSen(totalSen)}
          </Text>
        </View>
      </BentoCard>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.caption, fontWeight: '700', color: colors.muted },
  empty: { fontSize: typography.caption, color: colors.muted, fontWeight: '500' },
  row: {},
  pressed: { opacity: 0.75 },
  rowMain: { flex: 1 },
  name: { fontSize: typography.caption, fontWeight: '600', color: colors.text },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  date: { fontSize: typography.caption, color: colors.muted },
  dateOverdue: { color: colors.danger, fontWeight: '600' },
  amount: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.text,
    fontVariant: moneyFontVariant,
  },
  amountOverdue: { color: colors.danger },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: { fontSize: typography.caption, color: colors.muted, fontWeight: '500' },
  footerAmount: {
    fontSize: typography.caption,
    fontWeight: '800',
    color: colors.text,
    fontVariant: moneyFontVariant,
  },
});
