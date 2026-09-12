/**
 * AccountService (plan 004 / ARCHITECTURE §2 application services) —
 * thin orchestration + validation over AccountRepository. User-scoping comes
 * from the current user resolved via the injected auth handle (AuthService).
 * No SQL, no financial math here — just validation and delegation.
 */
import type { Account, User } from '@/db/schema';
import type { AccountRepository, AccountInput, AccountType } from '@/repositories/types';
import { ACCOUNT_TYPES } from '@/repositories/types';

/** Minimal auth handle the service resolves the current user from (AuthService satisfies this). */
export interface CurrentUserSource {
  currentUser(): Promise<User | null>;
}

export class AccountService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly auth: CurrentUserSource,
  ) {}

  /** Resolve the signed-in user; reject if none (gate enforced upstream, defended here). */
  private async requireUserId(): Promise<number> {
    const user = await this.auth.currentUser();
    if (!user) throw new Error('not signed in');
    return user.id;
  }

  async create(input: AccountInput): Promise<Account> {
    const userId = await this.requireUserId();
    const name = input.name.trim();
    if (!name) throw new Error('account name required');
    if (!(ACCOUNT_TYPES as readonly string[]).includes(input.type)) {
      throw new Error('invalid account type');
    }
    if (!Number.isInteger(input.initialBalanceSen) || input.initialBalanceSen < 0) {
      throw new Error('invalid initial balance');
    }
    return this.accounts.create({ userId, name, type: input.type, initialBalanceSen: input.initialBalanceSen });
  }

  async list(): Promise<Account[]> {
    return this.accounts.list(await this.requireUserId());
  }

  /** Available money = sum of balances (credit-card owed negated). */
  async sumBalances(): Promise<number> {
    return this.accounts.sumBalances(await this.requireUserId());
  }

  /**
   * Correct an account's recorded balance (credit_card: the amount owed).
   * This is a restatement of the figure, not a transaction: no expense is
   * written and no other row changes, so past expenses keep their history.
   */
  async setBalance(id: number, balanceSen: number): Promise<Account> {
    const userId = await this.requireUserId();
    if (!Number.isInteger(balanceSen) || balanceSen < 0) {
      throw new Error('invalid balance');
    }
    return this.accounts.setBalance(userId, id, balanceSen);
  }

  /** Deletes only when no expense references the account (FK-protected). */
  async delete(id: number): Promise<void> {
    return this.accounts.delete(await this.requireUserId(), id);
  }
}

export type { AccountType };