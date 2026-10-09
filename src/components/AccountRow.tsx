/**
 * AccountRow (plan 004 → plan 008 redesign) — one account rendered as a
 * stacked payment card inside the Connected Accounts section of Settings.
 *
 * Visual hierarchy:
 *  - BentoCard surface with hairline border
 *  - Liquid accounts (cash/bank/ewallet): Electric Mint accent, positive
 *    balance via MoneyDisplay with `className="text-emerald-600 dark:text-emerald-400"`
 *  - Credit card accounts: Vivid Rose debt styling with OWED label
 *
 * Preserved test contracts:
 *  - testID={`account-row-${account.id}`}      — outer pressable
 *  - testID={`account-balance-${account.id}`}  — balance text
 *  - testID={`account-delete-${account.id}`}   — delete button
 */
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Account } from '@/db/schema';
import type { AccountType } from '@/repositories/types';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { StatusPill } from '@/components/ui/StatusPill';
import { BentoCard } from '@/components/ui/BentoCard';
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS } from './accountMeta';

export function AccountRow({
  account,
  onPress,
  onDelete,
}: {
  account: Account;
  /** Opens the adjust-balance sheet. */
  onPress: () => void;
  onDelete: () => void;
}) {
  const isCreditCard = account.type === 'credit_card';
  const type = account.type as AccountType;

  return (
    <BentoCard className="mb-2 p-0 overflow-hidden">
      <Pressable
        onPress={onPress}
        className="flex-row items-center px-4 py-3 gap-3"
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={
          isCreditCard
            ? `${account.name}, owed ${account.balanceSen} sen`
            : `${account.name}, balance ${account.balanceSen} sen`
        }
        accessibilityHint={isCreditCard ? 'Adjust the amount owed' : 'Adjust the balance'}
        testID={`account-row-${account.id}`}
      >
        {/* Type icon bubble */}
        <View
          className={
            isCreditCard
              ? 'w-10 h-10 rounded-full items-center justify-center bg-rose-50 dark:bg-rose-900/20'
              : 'w-10 h-10 rounded-full items-center justify-center bg-emerald-50 dark:bg-emerald-900/20'
          }
        >
          <Ionicons
            name={ACCOUNT_TYPE_ICONS[type] as never}
            size={20}
            color={isCreditCard ? '#B91C1C' : '#15803D'}
          />
        </View>

        {/* Name + type label */}
        <View className="flex-1 mr-2">
          <Text
            className="text-sm font-bold text-foreground"
            numberOfLines={1}
          >
            {account.name}
          </Text>
          <Text className="text-xs text-muted-foreground font-medium mt-0.5">
            {ACCOUNT_TYPE_LABELS[type]}
          </Text>
        </View>

        {/* Balance + debt pill */}
        <View className="items-end mr-2">
          {isCreditCard ? (
            <>
              <StatusPill variant="danger" label="OWED" className="mb-0.5 self-end" />
              <MoneyDisplay
                amountInSen={account.balanceSen}
                size="sm"
                className="text-rose-700 dark:text-rose-400"
                testID={`account-balance-${account.id}`}
              />
            </>
          ) : (
            <MoneyDisplay
              amountInSen={account.balanceSen}
              size="sm"
              className="text-emerald-700 dark:text-emerald-400"
              testID={`account-balance-${account.id}`}
            />
          )}
        </View>

        {/* Delete button — separate hit area */}
        <Pressable
          onPress={onDelete}
          className="w-11 h-11 items-center justify-center"
          style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${account.name}`}
          testID={`account-delete-${account.id}`}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color="#B91C1C" />
        </Pressable>
      </Pressable>
    </BentoCard>
  );
}