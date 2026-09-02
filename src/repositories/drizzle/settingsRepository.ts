/**
 * Drizzle SettingsRepository (plan 010) — the only SettingsRepository impl in
 * the MVP. Compatible with both the app's expo-sqlite AppDatabase (sync
 * session over openDatabaseSync) and the Node harness BetterSQLite3Database
 * (sync).
 *
 * The `settings` table is single-row per user (PK = user_id) and shipped in
 * migration 0000 (plan 010/016 folded it into the initial set), so this plan
 * adds NO schema or migration — only the repository, the service, and the
 * cash-flow consumption.
 *
 * Missing-row semantics (SET-1): the committed column default (30000 sen =
 * RM300) applies until the user first writes a setting; `buffer()` returns
 * that default for a rowless user, never null. `setBuffer()` upserts on the
 * PK — the user's first write creates the row, later writes replace in place.
 *
 * NEVER secrets: AI keys live in SecureStore (plan 013); this table holds
 * preferences only (buffer, provider/model selections).
 *
 * All queries are user-scoped (A10) — every WHERE filters by `userId`.
 */
import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { settings, type Settings } from '@/db/schema';
import type { AiPrefs, SettingsRepository } from '../types';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('@/db/schema')>;

/** PRD SET-1 default safety buffer: RM300 = 30,000 sen (mirrors the column default). */
export const DEFAULT_SAFETY_BUFFER_SEN = 30000;

export class DrizzleSettingsRepository implements SettingsRepository {
  constructor(private readonly db: AnyDb) {}

  /** The user's buffer value, or the RM300 default when no settings row exists. */
  async buffer(userId: number): Promise<number> {
    const rows = (await this.db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId))) as unknown as Settings[];
    return rows[0]?.safetyBufferSen ?? DEFAULT_SAFETY_BUFFER_SEN;
  }

  /** Insert or REPLACE the user's single settings row (upsert on the user_id PK). */
  async setBuffer(userId: number, safetyBufferSen: number): Promise<Settings> {
    const rows = (await this.db
      .insert(settings)
      .values({ userId, safetyBufferSen })
      .onConflictDoUpdate({
        target: settings.userId,
        set: { safetyBufferSen, updatedAt: Date.now() },
      })
      .returning()) as unknown as Settings[];
    const row = rows[0];
    if (!row) throw new Error('settings upsert failed — row not found after insert');
    return row;
  }

  /** The user's AI prefs, or all-null defaults when no settings row exists yet. */
  async aiPrefs(userId: number): Promise<AiPrefs> {
    const rows = (await this.db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId))) as unknown as Settings[];
    const row = rows[0];
    if (!row) {
      return { aiActiveProvider: null, aiModelGemini: null, aiModelDeepseek: null };
    }
    return {
      aiActiveProvider: (row.aiActiveProvider as AiPrefs['aiActiveProvider']) ?? null,
      aiModelGemini: row.aiModelGemini ?? null,
      aiModelDeepseek: row.aiModelDeepseek ?? null,
    };
  }

  /** Upsert only the patched AI-pref fields (undefined = untouched, null = clear). */
  async setAiPrefs(userId: number, patch: Partial<AiPrefs>): Promise<Settings> {
    const fields: {
      aiActiveProvider?: 'gemini' | 'deepseek' | null;
      aiModelGemini?: string | null;
      aiModelDeepseek?: string | null;
    } = {};
    if (patch.aiActiveProvider !== undefined) fields.aiActiveProvider = patch.aiActiveProvider;
    if (patch.aiModelGemini !== undefined) fields.aiModelGemini = patch.aiModelGemini;
    if (patch.aiModelDeepseek !== undefined) fields.aiModelDeepseek = patch.aiModelDeepseek;
    if (Object.keys(fields).length === 0) {
      throw new Error('setAiPrefs requires at least one field');
    }
    const rows = (await this.db
      .insert(settings)
      .values({ userId, ...fields })
      .onConflictDoUpdate({
        target: settings.userId,
        set: { ...fields, updatedAt: Date.now() },
      })
      .returning()) as unknown as Settings[];
    const row = rows[0];
    if (!row) throw new Error('settings upsert failed — row not found after insert');
    return row;
  }
}
