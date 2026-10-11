import { describe, expect, it } from '@jest/globals';
import { users, type User } from '@/db/schema';
import { createMigratedTestDb } from '@/db/testing';
import { DrizzleSettingsRepository } from '@/repositories/drizzle/settingsRepository';
import type { CurrentUserSource } from '@/services/AccountService';
import { SettingsService } from '@/services/SettingsService';

describe('SettingsService', () => {
  async function makeFixture(signedIn = true) {
    const test = createMigratedTestDb();
    test.db
      .insert(users)
      .values([
        { email: 'user1@example.com', passwordHash: 'hash' },
        { email: 'user2@example.com', passwordHash: 'hash' },
      ])
      .run();
    const all = test.db.select().from(users).all() as User[];
    const user1 = all.find((u) => u.email === 'user1@example.com')!;
    const user2 = all.find((u) => u.email === 'user2@example.com')!;

    const repo = new DrizzleSettingsRepository(test.db as unknown as never);
    const auth1: CurrentUserSource = { currentUser: async () => (signedIn ? user1 : null) };
    const auth2: CurrentUserSource = { currentUser: async () => user2 };

    const service1 = new SettingsService(repo, auth1);
    const service2 = new SettingsService(repo, auth2);

    return { test, user1, user2, repo, service1, service2 };
  }

  it('rejects when not signed in', async () => {
    const { service1 } = await makeFixture(false);
    await expect(service1.getThemeMode()).rejects.toThrow('not signed in');
    await expect(service1.setThemeMode('light')).rejects.toThrow('not signed in');
  });

  it('rejects invalid theme modes', async () => {
    const { service1 } = await makeFixture();
    await expect(service1.setThemeMode('blue' as never)).rejects.toThrow();
  });

  it('defaults to dark and updates to light / system', async () => {
    const { service1 } = await makeFixture();
    expect(await service1.getThemeMode()).toBe('dark');

    const updated = await service1.setThemeMode('light');
    expect(updated.themeMode).toBe('light');
    expect(await service1.getThemeMode()).toBe('light');

    await service1.setThemeMode('system');
    expect(await service1.getThemeMode()).toBe('system');
  });

  it('preserves user scoping between different users', async () => {
    const { service1, service2 } = await makeFixture();
    await service1.setThemeMode('light');
    expect(await service1.getThemeMode()).toBe('light');
    expect(await service2.getThemeMode()).toBe('dark');
  });
});
