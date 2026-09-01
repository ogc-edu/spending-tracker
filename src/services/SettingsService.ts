/**
 * SettingsService (plan 010 / ARCHITECTURE §2 application services) — the
 * minimal settings surface plan 010 needs: read/write the cash-flow safety
 * buffer (PRD SET-1). No Settings UI in this plan (that lands in 016 polish);
 * the service default is enough for the dashboard formula.
 *
 * User-scoping comes from the current user resolved via the injected auth
 * handle (AuthService). No SQL, no money math — validation + delegation only.
 * The buffer is integer sen ≥ 0 (0 is a legitimate "no buffer" choice; the
 * 30000 default is the missing-row answer, never a null).
 */
import type { Settings } from '@/db/schema';
import type { SettingsRepository } from '@/repositories/types';
import type { CurrentUserSource } from './AccountService';

export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly auth: CurrentUserSource,
  ) {}

  /** Resolve the signed-in user; reject if none (gate enforced upstream, defended here). */
  private async requireUserId(): Promise<number> {
    const user = await this.auth.currentUser();
    if (!user) throw new Error('not signed in');
    return user.id;
  }

  /**
   * The safety buffer in sen — the term CashFlowService feeds into
   * engine.safeToSpend (PRD §8.4). RM300 (30000 sen) until the user
   * overrides it (SET-1).
   */
  async getBuffer(): Promise<number> {
    return this.settings.buffer(await this.requireUserId());
  }

  /** Persist a new buffer. Rejects non-integer or negative sen. */
  async setBuffer(safetyBufferSen: number): Promise<Settings> {
    const userId = await this.requireUserId();
    if (!Number.isInteger(safetyBufferSen) || safetyBufferSen < 0) {
      throw new Error('invalid safety buffer');
    }
    return this.settings.setBuffer(userId, safetyBufferSen);
  }
}
