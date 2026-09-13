/**
 * AccountRow (plan 004) — one account in Settings. The row itself is a button:
 * pressing it opens the balance sheet (the balance is the only editable field
 * an account has). The trash button keeps its own hit area, so deleting is
 * never a mis-tap of "adjust".
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Account } from '@/db/schema';
import type { AccountType } from '@/repositories/types';
import { formatSen } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
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
  const balanceText = isCreditCard ? `Owed ${formatSen(account.balanceSen)}` : formatSen(account.balanceSen);
  const themeColor = isCreditCard ? colors.danger : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${account.name}, ${balanceText}`}
      accessibilityHint={isCreditCard ? 'Adjust the amount owed' : 'Adjust the balance'}
      testID={`account-row-${account.id}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${themeColor}18` }]}>
        <Ionicons
          name={ACCOUNT_TYPE_ICONS[type] as never}
          size={20}
          color={themeColor}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {account.name}
        </Text>
        <Text style={styles.type}>{ACCOUNT_TYPE_LABELS[type]}</Text>
      </View>
      <Text
        style={[styles.balance, isCreditCard && styles.owed]}
        testID={`account-balance-${account.id}`}
      >
        {balanceText}
      </Text>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${account.name}`}
        testID={`account-delete-${account.id}`}
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  info: { flex: 1, marginRight: spacing.sm },
  name: { fontSize: typography.body, fontWeight: '700', color: colors.text },
  type: { fontSize: typography.caption, color: colors.muted, fontWeight: '500', marginTop: 1 },
  balance: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.md,
    fontVariant: moneyFontVariant,
  },
  owed: { color: colors.danger },
  rowPressed: { opacity: 0.85 },
  delete: { padding: spacing.xs },
  pressed: { opacity: 0.5 },
});