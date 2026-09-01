/**
 * Account type display metadata (plan 004 UI). Icons are Ionicons names.
 * `credit_card` balance shows as "Owed", never as positive available.
 */
import type { AccountType } from '@/repositories/types';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Cash',
  bank: 'Bank',
  ewallet: 'E-wallet',
  credit_card: 'Credit card',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  cash: 'cash-outline',
  bank: 'business-outline',
  ewallet: 'wallet-outline',
  credit_card: 'card-outline',
};