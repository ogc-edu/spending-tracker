/**
 * Plan 016 — EmptyState component tests: renders icon+title+body; the
 * optional action renders as a ≥44pt button and fires exactly once; no
 * action → no button rendered.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { EmptyState } from '../EmptyState';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

describe('EmptyState (plan 016)', () => {
  it('renders title and body copy', async () => {
    const tree = await render(<EmptyState icon="receipt-outline" title="No expenses yet" body="Tap + to record lunch." />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('No expenses yet');
    expect(json).toContain('Tap + to record lunch.');
  });

  it('renders no action when none is provided', async () => {
    const tree = await render(<EmptyState icon="receipt-outline" title="Empty" body="Nothing here" />);
    expect(tree.root.findAllByProps({ testID: 'empty-state-action' })).toHaveLength(0);
  });

  it('renders the action as a ≥44pt button and fires it once', async () => {
    const onPress = jest.fn();
    const tree = await render(
      <EmptyState
        icon="wallet-outline"
        title="No accounts yet"
        body="Add one."
        action={{ label: 'Create an account', onPress }}
        testID="dashboard-empty-accounts"
      />,
    );
    const action = tree.root.findByProps({ testID: 'dashboard-empty-accounts-action' });
    const styleFn = action.props.style as (state: { pressed: boolean }) => unknown;
    const flattened = StyleSheet.flatten(styleFn({ pressed: false })) as { minHeight: number };
    expect(action.props.accessibilityRole).toBe('button');
    expect(flattened.minHeight).toBeGreaterThanOrEqual(44);
    await act(async () => {
      action.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});