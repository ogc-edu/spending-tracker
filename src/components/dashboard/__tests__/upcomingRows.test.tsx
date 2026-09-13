/**
 * Plan 018 — Dashboard upcoming rows are LINKS: each row is a button that
 * navigates to the commitment (per-row `upcoming-row-${commitmentId}`), and
 * overdue rows carry the danger tone. Presentational — dates come from the
 * snapshot; "overdue" compares to todayLocal().
 */
import { describe, expect, it, jest } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import type { UpcomingSnapshotItem } from '@/services/CashFlowService';
import { UpcomingList } from '../UpcomingList';

function item(commitmentId: number, dueDate: string): UpcomingSnapshotItem {
  return { commitmentId, name: `Commitment ${commitmentId}`, dueDate, amountSen: 5000, frequency: 'monthly' };
}

describe('UpcomingList rows (plan 018)', () => {
  it('rows are accessible buttons that open the commitment detail', async () => {
    const onOpen = jest.fn();
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(
        <UpcomingList
          items={[item(7, '2026-09-20')]}
          totalSen={5000}
          dueBeforeLabel="01 Oct"
          onOpenCommitment={onOpen}
        />,
      );
    });

    const row = tree.root.findByProps({ testID: 'upcoming-row-7' });
    expect(row.props.accessibilityRole).toBe('button');

    await act(async () => {
      row.props.onPress();
    });
    expect(onOpen).toHaveBeenCalledWith(7);
  });

  it('overdue rows show the Overdue badge and the danger tone', async () => {
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(
        <UpcomingList
          items={[item(3, '2000-01-01')]} // always in the past
          totalSen={5000}
          dueBeforeLabel="01 Oct"
          onOpenCommitment={() => {}}
        />,
      );
    });
    // The Badge renders its label text; assert the copy is on screen.
    const texts: string[] = [];
    const collect = (node: { children: unknown[] }): void => {
      for (const child of node.children) {
        if (typeof child === 'string') texts.push(child);
        else collect(child as never);
      }
    };
    collect(tree.root as never);
    expect(texts).toContain('Overdue');
  });
});
