/**
 * PayrollService (payroll-in) — the standing split of the user's pay across
 * their accounts, and the one action that applies it.
 *
 * The model: each account may hold one allocation ("RM1,500 to Savings").
 * Pressing "Payroll in" credits every allocated account by its amount in a
 * single transaction and stamps the run time.
 *
 * What it deliberately is NOT: income history. The app tracks expenses, not
 * income (PRD scope), so a deposit moves balances and nothing else — no
 * expense row, no engine change. Available money simply rises, and
 * safe-to-spend follows from it on the next read.
 *
 * Credit cards are not payroll targets: their balance is money OWED, so
 * "depositing" into one would silently mean "take on more debt". Paying a card
 * down belongs to commitments, where it is already modelled.
 *
 * No SQL and no money math here — validation, scoping and delegation only.
 */
import type { Account, PayrollAllocation } from '@/db/schema';
import type { AccountRepository, PayrollRepository } from '@/repositories/types';
import type { CurrentUserSource } from './AccountService';

/** An allocation joined with the account it pays into (what the UI renders). */
export interface PayrollLine {
  allocation: PayrollAllocation;
  account: Account;
}

export interface PayrollPlan {
  lines: PayrollLine[];
  /** Sum of every allocation — what one "Payroll in" deposits. */
  totalSen: number;
  /** Epoch ms of the last run; null = never. */
  lastRunAt: number | null;
}

export const PAYROLL_CREDIT_CARD_MESSAGE =
  'Payroll can only go into cash, bank or e-wallet accounts — a credit card tracks money owed.';

export class PayrollService {
  constructor(
    private readonly payroll: PayrollRepository,
    private readonly accounts: AccountRepository,
    private readonly auth: CurrentUserSource,
  ) {}

  /** Resolve the signed-in user; reject if none (gate enforced upstream, defended here). */
  private async requireUserId(): Promise<number> {
    const user = await this.auth.currentUser();
    if (!user) throw new Error('not signed in');
    return user.id;
  }

  /**
   * The whole payroll picture: allocations joined to their accounts, the
   * total, and when it last ran. Allocations whose account has vanished are
   * skipped (the FK cascade normally removes them first).
   */
  async plan(): Promise<PayrollPlan> {
    const userId = await this.requireUserId();
    const [allocations, accounts, lastRunAt] = await Promise.all([
      this.payroll.list(userId),
      this.accounts.list(userId),
      this.payroll.lastRunAt(userId),
    ]);
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const lines: PayrollLine[] = [];
    for (const allocation of allocations) {
      const account = byId.get(allocation.accountId);
      if (account) lines.push({ allocation, account });
    }
    return {
      lines,
      totalSen: lines.reduce((sum, line) => sum + line.allocation.amountSen, 0),
      lastRunAt,
    };
  }

  /** Set (or replace) one account's slice of the split. */
  async setAllocation(accountId: number, amountSen: number): Promise<PayrollAllocation> {
    const userId = await this.requireUserId();
    if (!Number.isInteger(amountSen) || amountSen <= 0) {
      throw new Error('invalid payroll amount');
    }
    const account = await this.accounts.byId(userId, accountId);
    if (!account) throw new Error('Account not found');
    if (account.type === 'credit_card') throw new Error(PAYROLL_CREDIT_CARD_MESSAGE);
    return this.payroll.upsert(userId, accountId, amountSen);
  }

  /** Drop an account's slice. Removing one that isn't allocated is a no-op. */
  async removeAllocation(accountId: number): Promise<void> {
    return this.payroll.remove(await this.requireUserId(), accountId);
  }

  /**
   * Apply the split: every allocated account is credited in one transaction.
   * `now` is passed in (never derived here) so the run time is the caller's
   * reference date — the same discipline the engine follows.
   */
  async deposit(now: Date = new Date()): Promise<{ depositedSen: number; accounts: Account[] }> {
    const userId = await this.requireUserId();
    const allocations = await this.payroll.list(userId);
    if (allocations.length === 0) throw new Error('no payroll allocations');
    const accounts = await this.payroll.deposit(userId, now.getTime());
    return {
      depositedSen: allocations.reduce((sum, allocation) => sum + allocation.amountSen, 0),
      accounts,
    };
  }
}
