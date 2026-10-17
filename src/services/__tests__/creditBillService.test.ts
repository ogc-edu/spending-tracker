import { beforeEach, describe, expect, it } from '@jest/globals';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { users as usersTable } from '@/db/schema';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzleExpenseRepository } from '@/repositories/drizzle/expenseRepository';
import { DrizzleCreditBillRepository } from '@/repositories/drizzle/creditBillRepository';
import { CreditBillService } from '../CreditBillService';
import type { CurrentUserSource } from '../AccountService';

function makeAuth(userId: number): CurrentUserSource {
  return {
    currentUser: async () => ({ id: userId, email: 'test@example.com', passwordHash: 'hash', createdAt: Date.now() }),
  };
}

describe('CreditBillService integration tests', () => {
  let test: TestDb;
  let userId: number;
  let accounts: DrizzleAccountRepository;
  let expenses: DrizzleExpenseRepository;
  let creditBillsRepo: DrizzleCreditBillRepository;
  let service: CreditBillService;

  beforeEach(async () => {
    test = createMigratedTestDb();
    await insertDefaultCategoriesIfEmpty(test.db as never);
    const user = test.db
      .insert(usersTable)
      .values({ email: 'user@example.com', passwordHash: 'hash', createdAt: Date.now() })
      .returning()
      .all()[0]!;
    userId = user.id;

    accounts = new DrizzleAccountRepository(test.db as never);
    expenses = new DrizzleExpenseRepository(test.db as never);
    creditBillsRepo = new DrizzleCreditBillRepository(test.db as never);
    service = new CreditBillService(accounts, expenses, creditBillsRepo, makeAuth(userId));
  });

  it('lists bills for a configured credit account and returns empty for unconfigured', async () => {
    const card = await accounts.create({
      userId,
      name: 'Maybank Card',
      type: 'credit_card',
      initialBalanceSen: 0,
      statementDay: 20,
      dueDay: 31,
    });

    const unconfigured = await accounts.create({
      userId,
      name: 'ShopeePayLater',
      type: 'paylater',
      initialBalanceSen: 0,
    });

    // Unconfigured returns []
    expect(await service.listBillsForAccount(unconfigured.id, '2026-10-10')).toEqual([]);

    // Configured returns bills
    const bills = await service.listBillsForAccount(card.id, '2026-10-10');
    expect(bills.length).toBeGreaterThan(0);
    expect(bills[0]?.label).toContain('bill');
  });

  it('pays a bill: atomic balance adjustments, no expense created, refuses overpayment', async () => {
    const bank = await accounts.create({
      userId,
      name: 'Savings',
      type: 'bank',
      initialBalanceSen: 100000, // 1,000.00 available
    });

    const spl = await accounts.create({
      userId,
      name: 'SPayLater',
      type: 'paylater',
      initialBalanceSen: 0,
      statementDay: 20,
      dueDay: 31,
    });

    // Create an expense in the September bill (closes 20 Sep)
    // 2026-09-10: RM50.00 Food
    await expenses.transaction((tx) => {
      tx.insert({
        userId,
        amountSen: 5000,
        categoryId: 1,
        accountId: spl.id,
        date: '2026-09-10',
        description: 'Dinner',
      });
      tx.adjustBalance(userId, spl.id, 5000); // owed increases by 50.00
    });

    // At 2026-09-25, September bill is closed and unpaid, outstanding = 5000
    const billsBefore = await service.listBillsForAccount(spl.id, '2026-09-25');
    const sepBill = billsBefore.find((b) => b.month === 9 && b.year === 2026);
    expect(sepBill?.status).toBe('unpaid');
    expect(sepBill?.outstandingSen).toBe(5000);

    // Refuse overpayment: paying 60.00 when outstanding is 50.00
    await expect(
      service.payBill({
        userId,
        accountId: spl.id,
        billYear: 2026,
        billMonth: 9,
        amountSen: 6000,
        fromAccountId: bank.id,
        paidDate: '2026-09-26',
      }),
    ).rejects.toThrow(/exceeds bill outstanding/);

    // Refuse paying from another credit account
    const otherCredit = await accounts.create({
      userId,
      name: 'Other Card',
      type: 'credit_card',
      initialBalanceSen: 0,
    });
    await expect(
      service.payBill({
        userId,
        accountId: spl.id,
        billYear: 2026,
        billMonth: 9,
        amountSen: 5000,
        fromAccountId: otherCredit.id,
        paidDate: '2026-09-26',
      }),
    ).rejects.toThrow(/cannot pay credit bill from another credit account/);

    // Pay full bill: 50.00
    const payment = await service.payBill({
        userId,
        accountId: spl.id,
        billYear: 2026,
        billMonth: 9,
        amountSen: 5000,
        fromAccountId: bank.id,
        paidDate: '2026-09-26',
    });

    expect(payment.amountSen).toBe(5000);

    // Verify balance effects:
    // Credit account owed decrements by 50.00: 5000 - 5000 = 0
    const updatedSpl = await accounts.byId(userId, spl.id);
    expect(updatedSpl?.balanceSen).toBe(0);

    // Bank account decrements by 50.00: 100000 - 5000 = 95000
    const updatedBank = await accounts.byId(userId, bank.id);
    expect(updatedBank?.balanceSen).toBe(95000);

    // Bill is now paid
    const billsAfter = await service.listBillsForAccount(spl.id, '2026-09-26');
    const sepBillAfter = billsAfter.find((b) => b.month === 9 && b.year === 2026);
    expect(sepBillAfter?.status).toBe('paid');
    expect(sepBillAfter?.outstandingSen).toBe(0);

    // No expense was created
    const expenseList = await expenses.query(userId);
    expect(expenseList).toHaveLength(1);
    expect(expenseList[0]?.amountSen).toBe(5000);

    // Undo payment
    await service.undoPayment(payment.id);

    // Balances are restored
    expect((await accounts.byId(userId, spl.id))?.balanceSen).toBe(5000);
    expect((await accounts.byId(userId, bank.id))?.balanceSen).toBe(100000);

    // Bill is unpaid again
    const billsAfterUndo = await service.listBillsForAccount(spl.id, '2026-09-26');
    expect(billsAfterUndo.find((b) => b.month === 9)?.status).toBe('unpaid');
  });

  it('getBillsDueBefore returns unpaid closed bills due on or before endDate', async () => {
    const card = await accounts.create({
      userId,
      name: 'Credit Card',
      type: 'credit_card',
      initialBalanceSen: 0,
      statementDay: 20,
      dueDay: 31,
    });

    // Purchase on 10 Sep in September bill (closes 20 Sep, due 30 Sep)
    await expenses.transaction((tx) => {
      tx.insert({
        userId,
        amountSen: 12000,
        categoryId: 1,
        accountId: card.id,
        date: '2026-09-10',
        description: 'Shopping',
      });
      tx.adjustBalance(userId, card.id, 12000);
    });

    // Reference date 25 Sep: September bill is closed and unpaid, due 30 Sep
    const dueBills = await service.getBillsDueBefore('2026-09-25', '2026-09-30');
    expect(dueBills).toHaveLength(1);
    expect(dueBills[0]?.bill.month).toBe(9);
    expect(dueBills[0]?.bill.outstandingSen).toBe(12000);
    expect(dueBills[0]?.account.name).toBe('Credit Card');
  });
});
