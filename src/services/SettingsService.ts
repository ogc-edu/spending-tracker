/**
 * SettingsService (Plan 020 / Phase B & C).
 * Provides user-scoped settings access (theme mode, preferences).
 */
import { z } from 'zod';
import type { Settings } from '@/db/schema';
import type { SettingsRepository } from '@/repositories/types';
import type { CurrentUserSource } from './AccountService';

export const themeModeSchema = z.enum(['system', 'light', 'dark']);
export type ThemeMode = z.infer<typeof themeModeSchema>;

export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly auth: CurrentUserSource,
  ) {}

  private async requireUserId(): Promise<number> {
    const user = await this.auth.currentUser();
    if (!user) throw new Error('not signed in');
    return user.id;
  }

  async getThemeMode(): Promise<ThemeMode> {
    const userId = await this.requireUserId();
    return this.settings.themeMode(userId);
  }

  async setThemeMode(mode: ThemeMode): Promise<Settings> {
    const parsed = themeModeSchema.safeParse(mode);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'invalid theme mode');
    }
    const userId = await this.requireUserId();
    return this.settings.setThemeMode(userId, parsed.data);
  }
}
