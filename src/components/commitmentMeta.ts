/**
 * Commitment type display metadata (plan 008 UI). Icons are Ionicons names —
 * the semantic commitment types from PRD COM-1.
 */
import type { CommitmentType } from '@/repositories/types';

export const COMMITMENT_TYPE_LABELS: Record<CommitmentType, string> = {
  credit_card: 'Credit card repayment',
  installment: 'Installment',
  bnpl: 'BNPL',
  bill: 'Monthly bill',
  subscription: 'Subscription',
  rent: 'Rent',
  phone: 'Phone bill',
  owed: 'Money owed',
  other: 'Other',
};

export const COMMITMENT_TYPE_ICONS: Record<CommitmentType, string> = {
  credit_card: 'card-outline',
  installment: 'layers-outline',
  bnpl: 'flash-outline',
  bill: 'receipt-outline',
  subscription: 'repeat-outline',
  rent: 'home-outline',
  phone: 'call-outline',
  owed: 'hand-left-outline',
  other: 'ellipsis-horizontal-circle-outline',
};