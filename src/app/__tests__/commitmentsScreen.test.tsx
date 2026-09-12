/**
 * Commitments tab — DEFAULT ORDER: soonest next-due first, overdue at the top,
 * nothing-outstanding at the bottom. Rendered against the real screen with the
 * settings-screen harness seams (real Drizzle repos over a better-sqlite3 test
 * DB; expo-router and auth stubbed), so what is asserted is the order the list
 * actually paints — not just the comparator.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import CommitmentsScreen from '@/app/(tabs)/commitments';
import { ToastProvider } from '@/components/ToastProvider';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { users } from '@/db/schema';
import { DrizzleCommitmentRepository } from '@/repositories/drizzle/commitmentRepository';
import { addMonthsClamped, todayLocal } from '@/utils/dates';
import type { CurrentUserSource } from '@/services/AccountService';

const mockReposRef: { current: { commitments: object } | null } = { current: null };
const mockAuthRef: { current: CurrentUserSource } = { current: { currentUser: async () => null } };

jest.mock('@/db', () => ({
  repositories: () => mockReposRef.current,
}));

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect]);
    },
    useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  };
});

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ authService: mockAuthRef.current }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

async function renderScreen(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <ToastProvider>
        <CommitmentsScreen />
      </ToastProvider>,
    );
  });
  await act(async () => {}); // focus-load
  await act(async () => {}); // its promise continuations
  return tree;
}

/** The row names, in the order they are painted (findAll walks the tree in order). */
function renderedNames(tree: ReactTestRenderer): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const nodes = tree.root.findAll(
    (node: ReactTestInstance) =>
      typeof node.props?.testID === 'string' && /^commitment-name-\d+$/.test(node.props.testID),
  );
  for (const node of nodes) {
    const id = node.props.testID as string;
    if (seen.has(id)) continue; // composite + host both carry it
    seen.add(id);
    const texts: string[] = [];
    const collect = (instance: ReactTestInstance): void => {
      for (const child of instance.children) {
        if (typeof child === 'string') texts.push(child);
        else collect(child);
      }
    };
    collect(node);
    names.push(texts.join(''));
  }
  return names;
}

let db: TestDb;

/** A one-time commitment due on `dueDate` — the simplest single-slot schedule. */
async function oneTime(name: string, dueDate: string): Promise<void> {
  const repo = new DrizzleCommitmentRepository(db.db as unknown as never);
  await repo.create(1, {
    name,
    type: 'bill',
    totalSen: 10_000,
    remainingSen: 10_000,
    paymentSen: 10_000,
    frequency: 'one_time',
    startDate: dueDate,
    endDate: null,
    dueDate,
  });
}

describe('Commitments tab — default order is next due date', () => {
  beforeEach(async () => {
    db = createMigratedTestDb();
    const [user] = await db.db
      .insert(users)
      .values({ email: 'seed@example.com', passwordHash: 'test' })
      .returning();
    mockAuthRef.current = { currentUser: async () => user ?? null };
    mockReposRef.current = {
      commitments: new DrizzleCommitmentRepository(db.db as unknown as never),
    };
  });

  it('lists the soonest obligation first, whatever order they were created in', async () => {
    const today = todayLocal();
    // Created newest-first in the repository (desc id) — the opposite of due order.
    await oneTime('Far away', addMonthsClamped(today, 6));
    await oneTime('Next month', addMonthsClamped(today, 1));
    await oneTime('Due today', today);

    expect(renderedNames(await renderScreen())).toEqual(['Due today', 'Next month', 'Far away']);
  });

  it('floats overdue commitments to the top', async () => {
    const today = todayLocal();
    await oneTime('Upcoming', addMonthsClamped(today, 1));
    await oneTime('Missed', addMonthsClamped(today, -2)); // overdue
    await oneTime('Due today', today);

    expect(renderedNames(await renderScreen())).toEqual(['Missed', 'Due today', 'Upcoming']);
  });

  it('sinks a fully paid commitment below everything still owed', async () => {
    const today = todayLocal();
    const repo = new DrizzleCommitmentRepository(db.db as unknown as never);
    await oneTime('Settled', addMonthsClamped(today, -1));
    await oneTime('Still owed', addMonthsClamped(today, 3));

    // Pay the (older, overdue) one off — it has nothing outstanding now.
    const settled = (await repo.list(1)).find((c) => c.name === 'Settled');
    await repo.transaction((tx) => {
      tx.insertPayment({
        userId: 1,
        commitmentId: settled!.id,
        amountSen: 10_000,
        dueDate: settled!.dueDate,
        paidDate: today,
      });
    });

    expect(renderedNames(await renderScreen())).toEqual(['Still owed', 'Settled']);
  });
});
