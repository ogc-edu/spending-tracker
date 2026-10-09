/**
 * Plan 016 — money figure accessibility: spoken accessibilityLabels on the key
 * figures and (under the ios jest preset) tabular figures. Plan 020 replaced
 * the safe-to-spend / hero figures with Home's month summary.
 */
import { describe, expect, it } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MonthSummaryCard } from '../dashboard/MonthSummaryCard';
import { moneyFontVariant } from '@/theme';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

describe('plan 016 — money figures: spoken labels, tabular figures', () => {
  it('reads the month summary figures aloud with tabular figures', async () => {
    const tree = await render(
      <MonthSummaryCard spentSen={116000} dueSen={190000} monthLabel="October 2026" />,
    );
    // The host Text (MoneyDisplay forwards testID and sets the spoken label there).
    const host = (testID: string) =>
      tree.root.find((node) => typeof node.type === 'string' && node.props.testID === testID);
    const spent = host('summary-spent');
    const due = host('summary-due');
    expect(spent.props.accessibilityLabel).toBe('one thousand one hundred and sixty ringgit');
    expect(due.props.accessibilityLabel).toBe('one thousand nine hundred ringgit');
    for (const figure of [spent, due]) {
      const flattened = StyleSheet.flatten(figure.props.style as never) as { fontVariant?: unknown };
      expect(flattened.fontVariant).toEqual(moneyFontVariant);
    }
  });
});
