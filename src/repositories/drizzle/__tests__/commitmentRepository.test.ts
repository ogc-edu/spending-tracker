/**
 * Plan 008 — DrizzleCommitmentRepository against the better-sqlite3 harness.
 * Covers: create + list semantics (non-archived, newest first), archive
 * separation, paid-record queries, user scoping (A10), and transaction
 * atomicity of the sync tx-context (a throw rolls back payment + expense +
 * remaining together — the plan's integrity boundary).
 */
import { describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { commitments as commitmentsTable, users, type Commitment, type User } from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { DrizzleCommitmentRepository } from '@/repositories/drizzle/commitmentRepository';
import type { CommitmentInput } from '@/repositories/types';

interface Fixture {
  test: TestDb;
  user: User;
  repo: DrizzleCommitmentRepository;
}

function fixedInput(over: Partial<CommitmentInput> = {}): CommitmentInput {
  return {
    name: 'Phone installment',
    type: 'installment',
    totalSen: 120000,
    paymentSen: 40000,
    frequency: 'monthly',
    startDate: '2026-09-01',
    endDate: null,
    dueDate: '2026-09-01',
    ...over,
  };
}

async function makeFixture(): Promise<Fixture> {
  const test = createMigratedTestDb();
  test.db.insert(users).values({ email: 'owner@example.com', passwordHash: 'hash' }).run();
  const user = test.db.select().from(users).get() as User;
  await insertDefaultCategoriesIfEmpty(test.db);
  return { test, user, repo: new DrizzleCommitmentRepository(test.db as unknown as never) };
}

async function createFixed(fixture: Fixture, over: Partial<CommitmentInput> = {}): Promise<Commitment> {
  return fixture.repo.create(fixture.user.id, { ...fixedInput(over), remainingSen: 120000 });
}

describe('DrizzleCommitmentRepository — reads & scoping', () => {
  it('creates a fixed commitment with remainingSen = total', async () => {
    const fixture = await makeFixture();
    const row = await createFixed(fixture);
    expect(row.name).toBe('Phone installment');
    expect(row.totalSen).toBe(120000);
    expect(row.remainingSen).toBe(120000);
    expect(row.status).toBe('active');
    expect(row.archivedAt).toBeNull();
  });

  it('list() excludes archived rows (newest first); listArchived() returns them', async () => {
    const fixture = await makeFixture();
    const a = await createFixed(fixture, { name: 'A' });
    const b = await createFixed(fixture, { name: 'B' });
    fixture.test.db
      .update(commitmentsTable)
      .set({ archivedAt: Date.now() })
      .where(eq(commitmentsTable.id, a.id))
      .run();

    expect((await fixture.repo.list(fixture.user.id)).map((c) => c.name)).toEqual(['B']);
    expect((await fixture.repo.listArchived(fixture.user.id)).map((c) => c.name)).toEqual(['A']);
    // byId sees archived rows too (detail view + un-archive).
    expect((await fixture.repo.byId(fixture.user.id, a.id))?.archivedAt).not.toBeNull();
    expect((await fixture.repo.list(fixture.user.id).then((rows) => rows.map((r) => r.id)))[0]).toBe(
      b.id,
    );
  });

  it('another user can neither see nor touch the rows (A10)', async () => {
    const fixture = await makeFixture();
    const row = await createFixed(fixture);
    fixture.test.db.insert(users).values({ email: 'other@example.com', passwordHash: 'hash' }).run();
    const other = fixture.test.db.select().from(users).all().find((u) => u.email === 'other@example.com') as User;

    expect(await fixture.repo.byId(other.id, row.id)).toBeNull();
    expect(await fixture.repo.list(other.id)).toHaveLength(0);
    expect(await fixture.repo.listArchived(other.id)).toHaveLength(0);
    expect(await fixture.repo.paidPayments(other.id)).toHaveLength(0);
    await expect(
      fixture.repo.transaction((tx) => {
        tx.updateStatus(other.id, row.id, 'cancelled');
      }),
    ).resolves.toBeUndefined();
    expect((await fixture.repo.byId(fixture.user.id, row.id))?.status).toBe('active');
  });
});

describe('DrizzleCommitmentRepository — transaction (mark-paid / un-pay shape)', () => {
  it('a failing step rolls back EVERY statement (payment + expense + remaining)', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    const categoryId = 1;

    await expect(
      fixture.repo.transaction((tx) => {
        tx.insertPayment({
          userId: fixture.user.id,
          commitmentId: commitment.id,
          amountSen: 40000,
          dueDate: '2026-09-01',
          paidDate: '2026-09-01',
        });
        tx.insertExpense({
          userId: fixture.user.id,
          amountSen: 40000,
          categoryId,
          description: commitment.name,
          date: '2026-09-01',
          accountId: null,
          commitmentPaymentId: 1,
        });
        tx.adjustRemaining(fixture.user.id, commitment.id, -40000);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await fixture.repo.paidPayments(fixture.user.id)).toHaveLength(0);
    expect(
      (await fixture.test.db.select().from(commitmentsTable).all())[0]?.remainingSen,
    ).toBe(120000);
  });

  it('commitment_payments stores ONLY paid records; paidPayments returns them oldest-first', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    fixture.repo.transaction((tx) => {
      tx.insertPayment({
        userId: fixture.user.id,
        commitmentId: commitment.id,
        amountSen: 40000,
        dueDate: '2026-09-01',
        paidDate: '2026-09-05',
      });
    });
    fixture.repo.transaction((tx) => {
      tx.insertPayment({
        userId: fixture.user.id,
        commitmentId: commitment.id,
        amountSen: 40000,
        dueDate: '2026-10-01',
        paidDate: '2026-10-02',
      });
    });

    const payments = await fixture.repo.paidPayments(fixture.user.id);
    expect(payments.map((p) => p.dueDate)).toEqual(['2026-09-01', '2026-10-01']);
    expect(await fixture.repo.paymentsForCommitment(fixture.user.id, commitment.id)).toHaveLength(2);
  });
});