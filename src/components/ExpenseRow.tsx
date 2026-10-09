/**
 * ExpenseRow (Plan 004 — Audit Ledger)
 *
 * Ergonomic 3-column transaction row:
 * - Minimum 48px touch target (`TouchTarget`).
 * - Left: 40px circular category icon container with category-specific tinted background.
 * - Center: Primary payee label (`text-base font-semibold`) + metadata (`text-xs font-medium text-muted-foreground`).
 * - Auto-generated transactions render outline pill: `Linked Commitment`.
 * - Right: Formatted deduction amount (`-RM 24.50`) rendered with `MoneyDisplay`.
 * - Swipe interactions expose edit and delete triggers (with linked commitment delete lock).
 */
import { useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Category, Expense } from '@/db/schema';
import { categoryColor } from '@/components/categoryMeta';
import { formatDayLabel } from '@/utils/dates';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { StatusPill } from '@/components/ui/StatusPill';
import { TouchTarget } from '@/components/ui/TouchTarget';

export interface ExpenseRowProps {
  expense: Expense;
  category: Category | undefined;
  /** Null hides the account segment (expense has no account). */
  accountName: string | null;
  onPress(): void;
  onEdit?(): void;
  onDelete?(): void;
}

function formatTime(timestamp?: number | string | null): string | null {
  if (timestamp == null || timestamp === '') return null;
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return null;
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strMinutes = minutes < 10 ? '0' + minutes : String(minutes);
    const strHours = hours < 10 ? '0' + hours : String(hours);
    return `${strHours}:${strMinutes} ${ampm}`;
  } catch {
    return null;
  }
}

export function ExpenseRow({
  expense,
  category,
  accountName,
  onPress,
  onEdit,
  onDelete,
}: ExpenseRowProps) {
  const linked = expense.commitmentPaymentId !== null;
  const catColor = categoryColor(expense.categoryId);

  const [translateX] = useState(() => new Animated.Value(0));

  const [swipeController] = useState(() => {
    const ctrl = {
      open: false,
      close: () => {
        ctrl.open = false;
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 0,
        }).start();
      },
      panResponder: null as ReturnType<typeof PanResponder.create> | null,
    };

    ctrl.panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dy) < 8;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -120));
        } else if (ctrl.open && gestureState.dx > 0) {
          translateX.setValue(Math.min(-110 + gestureState.dx, 0));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -40) {
          ctrl.open = true;
          Animated.spring(translateX, {
            toValue: -110,
            useNativeDriver: false,
            bounciness: 0,
          }).start();
        } else {
          ctrl.open = false;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 0,
          }).start();
        }
      },
    });

    return ctrl;
  });

  const handleRowPress = () => {
    if (swipeController.open) {
      swipeController.close();
    } else {
      onPress();
    }
  };

  // Compose metadata line: time • category • account
  const metaParts: string[] = [];
  const time = formatTime(expense.createdAt);
  if (time) metaParts.push(time);
  if (expense.description && category?.name) {
    metaParts.push(category.name);
  } else if (!expense.description && !time && category?.name) {
    metaParts.push(category.name);
  }
  if (accountName) {
    metaParts.push(accountName);
  }
  const metaText = metaParts.length > 0 ? metaParts.join(' • ') : formatDayLabel(expense.date);

  return (
    <View className="overflow-hidden bg-card">
      {/* Background Swipe Actions */}
      <View className="absolute inset-y-0 right-0 flex-row items-center justify-end px-3 gap-2">
        {onEdit ? (
          <Pressable
            onPress={() => {
              swipeController.close();
              onEdit();
            }}
            className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 items-center justify-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Edit expense"
          >
            <Ionicons name="pencil-outline" size={18} color="#3b82f6" />
          </Pressable>
        ) : null}
        {onDelete && !linked ? (
          <Pressable
            onPress={() => {
              swipeController.close();
              onDelete();
            }}
            className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 items-center justify-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Delete expense"
          >
            <Ionicons name="trash-outline" size={18} color="#f43f5e" />
          </Pressable>
        ) : null}
      </View>

      {/* Foreground Animated Row */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...(swipeController.panResponder?.panHandlers ?? {})}
        className="bg-card"
      >
        <TouchTarget
          minHeight={48}
          onPress={handleRowPress}
          className="w-full flex-row items-center px-4 py-3 min-h-[52px] justify-between"
          accessibilityRole="button"
          testID={`expense-row-${expense.id}`}
        >
          {/* Left: 40px circular category icon container with category-specific tinted background */}
          <View
            className="w-10 h-10 rounded-full items-center justify-center mr-3 shrink-0"
            style={[styles.avatar, { backgroundColor: `${catColor}18` }]}
          >
            <Ionicons
              name={(category?.icon ?? 'receipt-outline') as never}
              size={18}
              color={catColor}
            />
          </View>

          {/* Center: Payee + Metadata + Linked Commitment pill */}
          <View className="flex-1 mr-3 justify-center">
            <View className="flex-row items-center gap-2">
              <Text
                className="text-base font-semibold text-foreground shrink"
                numberOfLines={1}
              >
                {expense.description ? expense.description : (category?.name ?? 'Expense')}
              </Text>
              {linked ? (
                <StatusPill
                  variant="warning"
                  label="Linked Commitment"
                  className="py-0 px-2 border border-amber-500/50 bg-amber-500/10 shrink-0"
                />
              ) : null}
            </View>

            <Text
              className="text-xs font-medium text-muted-foreground mt-0.5"
              numberOfLines={1}
            >
              {metaText}
            </Text>
          </View>

          {/* Right: Formatted deduction amount rendered with MoneyDisplay */}
          <View className="items-end shrink-0">
            <MoneyDisplay
              amountInSen={-Math.abs(expense.amountSen)}
              size="base"
              className="font-semibold text-foreground text-right"
            />
          </View>
        </TouchTarget>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});

