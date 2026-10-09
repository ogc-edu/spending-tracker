import * as React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ScheduleRow } from '@/components/ScheduleRow';
import type { ScheduledPayment } from '@/engine/commitments';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

describe('ScheduleRow — Digital Pass Mark as Paid and testID preservation', () => {
  const slot: ScheduledPayment = {
    dueDate: '2026-10-15',
    amountSen: 15_000,
    index: 1,
  };

  it('renders mark-paid-button and retains schedule-row-mark-paid for upcoming payment', async () => {
    const onMarkPaid = jest.fn();
    const onUnPay = jest.fn();

    const tree = await render(
      <ScheduleRow
        slot={slot}
        overdue={false}
        canMarkPaid={true}
        busy={false}
        onMarkPaid={onMarkPaid}
        onUnPay={onUnPay}
      />,
    );

    const markPaidBtn = tree.root.findByProps({ testID: 'mark-paid-button' });
    expect(markPaidBtn).toBeDefined();

    const scheduleRowMarkPaid = tree.root.findByProps({ testID: 'schedule-row-mark-paid' });
    expect(scheduleRowMarkPaid).toBeDefined();

    const upcomingRow = tree.root.findByProps({ testID: 'schedule-row-upcoming' });
    expect(upcomingRow).toBeDefined();
  });

  it('renders overdue badge when payment is overdue', async () => {
    const tree = await render(
      <ScheduleRow
        slot={slot}
        overdue={true}
        canMarkPaid={true}
        busy={false}
        onMarkPaid={jest.fn()}
        onUnPay={jest.fn()}
      />,
    );

    const overdueBadge = tree.root.findByProps({ testID: 'schedule-row-overdue' });
    expect(overdueBadge).toBeDefined();
  });

  it('renders schedule-row-paid and schedule-row-unpay when payment is already recorded', async () => {
    const payment = {
      id: 42,
      userId: 1,
      commitmentId: 10,
      amountSen: 15_000,
      dueDate: '2026-10-15',
      paidDate: '2026-10-14',
      status: 'paid',
      createdAt: Date.now(),
    };

    const tree = await render(
      <ScheduleRow
        slot={slot}
        payment={payment}
        accountName="Main Checking"
        overdue={false}
        canMarkPaid={true}
        busy={false}
        onMarkPaid={jest.fn()}
        onUnPay={jest.fn()}
      />,
    );

    const paidRow = tree.root.findByProps({ testID: 'schedule-row-paid' });
    expect(paidRow).toBeDefined();

    const unpayBtn = tree.root.findByProps({ testID: 'schedule-row-unpay' });
    expect(unpayBtn).toBeDefined();
  });
});
