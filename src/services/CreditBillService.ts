/**
 * CreditBillService (plan 020 Phase B, ARCH §8).
 *
 * Responsibilities:
 * - listBillsForAccount(accountId, referenceDate): derives bills for an account.
 * - getBillsDueBefore(referenceDate, endDate): finds unpaid closed credit bills due before endDate.
 * - payBill({ ... }): atomic transaction:
 *   - refuses overpayment against bill.outstandingSen
 *   - refuses credit account as payment source
 *   - decrements credit account owed (-amountSen)
 *   - decrements source account balance (-amountSen)
 *   - no expense is created
 * - undoPayment(paymentId): atomic transaction:
 *   - restores credit account owed (+amountSen)
 *   - restores source account balance (+amountSen)
 *   - deletes payment row
 */
import type { Account, CreditBillPayment } from '@/db/schema';
import {
  deriveCreditBills,
  type CreditBill,
  type CreditExpenseLike,
} from '@/engine/creditBills';
import type {
  AccountRepository,
  CreditBillRepository,
  ExpenseRepository,
} from '@/repositories/types';
import type { CurrentUserSource } from './AccountService';

export interface PayBillInput {
  userId?: number;
  accountId: number;
  billYear: number;
  billMonth: number;
  amountSen: number;
  fromAccountId: number;
  paidDate: string;
}

export interface DueCreditBillItem {
  bill: CreditBill;
  account: Account;
}

export class CreditBillService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly expenses: ExpenseRepository,
    private readonly creditBills: CreditBillRepository,
    private readonly auth: CurrentUserSource,
  ) {}

  private async requireUserId(): Promise<number> {
    const user = await this.auth.currentUser();
    if (!user) throw new Error('not signed in');
    return user.id;
  }

  async listBillsForAccount(accountId: number, referenceDate: string): Promise<CreditBill[]> {
    const userId = await this.requireUserId();
    const account = await this.accounts.byId(userId, accountId);
    if (!account) throw new Error('account not found');
    if (account.statementDay == null || account.dueDay == null) {
      return [];
    }

    const [expenseRows, installments, payments] = await Promise.all([
      this.expenses.query(userId, { accountId, limit: 10000 }),
      this.expenses.listInstallments(userId),
      this.creditBills.listPayments(userId, accountId),
    ]);

    const installmentByExpenseId = new Map(
      installments.map((inst) => [Number(inst.expenseId), inst]),
    );

    const creditExpenses: CreditExpenseLike[] = expenseRows.map((e) => {
      const inst = installmentByExpenseId.get(e.id);
      return {
        id: e.id,
        amountSen: e.amountSen,
        date: e.date,
        accountId: e.accountId,
        installment: inst
          ? {
              months: inst.months,
              monthlyRateBp: inst.monthlyRateBp,
              principalSen: inst.principalSen,
            }
          : null,
      };
    });

    return deriveCreditBills({
      account,
      expenses: creditExpenses,
      payments,
      referenceDate,
    });
  }

  async getBillsDueBefore(
    referenceDate: string,
    endDate: string,
  ): Promise<DueCreditBillItem[]> {
    const userId = await this.requireUserId();
    const allAccounts = await this.accounts.list(userId);
    const creditAccounts = allAccounts.filter(
      (a) => a.type === 'credit_card' || a.type === 'paylater',
    );

    const results: DueCreditBillItem[] = [];

    for (const acc of creditAccounts) {
      if (acc.statementDay == null || acc.dueDay == null) continue;
      const bills = await this.listBillsForAccount(acc.id, referenceDate);
      for (const bill of bills) {
        // Unpaid closed bills (including overdue) and open bills due on or before endDate
        if (
          (bill.status === 'unpaid' || bill.status === 'open') &&
          bill.outstandingSen > 0 &&
          bill.dueDate <= endDate
        ) {
          results.push({ bill, account: acc });
        }
      }
    }

    // Sort by due date ascending
    return results.sort((a, b) => (a.bill.dueDate < b.bill.dueDate ? -1 : a.bill.dueDate > b.bill.dueDate ? 1 : 0));
  }

  async payBill(input: PayBillInput): Promise<CreditBillPayment> {
    const userId = input.userId ?? (await this.requireUserId());
    if (input.amountSen <= 0) {
      throw new Error('payment amount must be greater than zero');
    }

    return this.creditBills.transaction((tx) => {
      const creditAccount = tx.getAccount(userId, input.accountId);
      if (!creditAccount) throw new Error('credit account not found');
      if (creditAccount.type !== 'credit_card' && creditAccount.type !== 'paylater') {
        throw new Error('target account must be a credit card or paylater account');
      }
      if (creditAccount.statementDay == null || creditAccount.dueDay == null) {
        throw new Error('credit account billing cycle is not configured');
      }

      const fromAccount = tx.getAccount(userId, input.fromAccountId);
      if (!fromAccount) throw new Error('payment source account not found');
      if (fromAccount.type === 'credit_card' || fromAccount.type === 'paylater') {
        throw new Error('cannot pay credit bill from another credit account');
      }

      // Re-derive bills inside the transaction to check outstanding amount
      const expenseRows = tx.listExpensesForAccount(userId, input.accountId);
      const installments = tx.listInstallments(userId);
      const payments = tx.listPaymentsForAccount(userId, input.accountId);

      const installmentByExpenseId = new Map(
        installments.map((inst) => [Number(inst.expenseId), inst]),
      );

      const creditExpenses: CreditExpenseLike[] = expenseRows.map((e) => {
        const inst = installmentByExpenseId.get(e.id);
        return {
          id: e.id,
          amountSen: e.amountSen,
          date: e.date,
          accountId: e.accountId,
          installment: inst
            ? {
                months: inst.months,
                monthlyRateBp: inst.monthlyRateBp,
                principalSen: inst.principalSen,
              }
            : null,
        };
      });

      const bills = deriveCreditBills({
        account: creditAccount,
        expenses: creditExpenses,
        payments,
        referenceDate: input.paidDate,
      });

      const bill = bills.find((b) => b.year === input.billYear && b.month === input.billMonth);
      if (!bill) {
        throw new Error('bill not found for specified year and month');
      }

      if (input.amountSen > bill.outstandingSen) {
        throw new Error(
          `payment amount (${input.amountSen}) exceeds bill outstanding (${bill.outstandingSen})`,
        );
      }

      // Insert payment record (A3 / plan 020)
      const payment = tx.insertPayment({
        userId,
        accountId: input.accountId,
        billYear: input.billYear,
        billMonth: input.billMonth,
        amountSen: input.amountSen,
        paidDate: input.paidDate,
        fromAccountId: input.fromAccountId,
      });

      // Decrement credit account owed (reduces owed)
      tx.adjustBalance(userId, creditAccount.id, -input.amountSen);

      // Decrement source account balance (reduces available)
      tx.adjustBalance(userId, fromAccount.id, -input.amountSen);

      return payment;
    });
  }

  async undoPayment(paymentId: string): Promise<void> {
    const userId = await this.requireUserId();
    return this.creditBills.transaction((tx) => {
      const payment = tx.getPaymentById(userId, paymentId);
      if (!payment) throw new Error('payment not found');

      const creditAccountId = Number(payment.accountId);
      const fromAccountId = Number(payment.fromAccountId);

      // Reverse balances: credit account owed goes back up (+amountSen), source account balance restored (+amountSen)
      tx.adjustBalance(userId, creditAccountId, +payment.amountSen);
      tx.adjustBalance(userId, fromAccountId, +payment.amountSen);

      // Delete payment row
      tx.deletePayment(userId, paymentId);
    });
  }
}
