/**
 * AccountRow (plan 004 UI) — one row in the Settings Accounts list.
 * Renders name, type badge, and balance; a credit-card account shows the amount
 * as **Owed** (never a positive available balance). A delete action fires
 * `onDelete` — the parent confirms + calls the service (FK-blocked there).
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Account } from '@/db/schema';
import type { AccountType } from '@/repositories/types';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS } from './accountMeta';

export function AccountRow({ account, onDelete }: { account: Account; onDelete: () => void }) {
  const isCreditCard = account.type === 'credit_card';
  const type = account.type as AccountType;
  const balanceText = isCreditCard ? `Owed ${formatSen(account.balanceSen)}` : formatSen(account.balanceSen);

  return (
    <View style={styles.row} testID={`account-row-${account.id}`}>
      <Ionicons
        name={ACCOUNT_TYPE_ICONS[type] as never}
        size={20}
        color={isCreditCard ? colors.danger : colors.accent}
        style={styles.icon}
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {account.name}
        </Text>
        <Text style={styles.type}>{ACCOUNT_TYPE_LABELS[type]}</Text>
      </View>
      <Text
        style={isCreditCard ? [styles.balance, styles.owed] : styles.balance}
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  icon: { marginRight: spacing.md },
  info: { flex: 1, marginRight: spacing.sm },
  name: { fontSize: typography.body, fontWeight: '600', color: colors.text },
  type: { fontSize: typography.caption, color: colors.muted },
  balance: { fontSize: typography.body, fontWeight: '600', color: colors.text, marginRight: spacing.md },
  owed: { color: colors.danger },
  delete: { padding: spacing.xs },
  pressed: { opacity: 0.5 },
});