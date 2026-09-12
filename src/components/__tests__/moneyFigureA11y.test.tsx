/**
 * Plan 016 — money figure accessibility + narrow-screen behavior:
 *  - spoken accessibilityLabels on the key figures ("Safe to spend, one
 *    thousand nine hundred ringgit" — the plan's fixture);
 *  - money Texts are single-line (truncate with ellipsis on narrow screens)
 *    and (under the ios jest preset) use tabular figures.
 */
import { describe, expect, it } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeToSpendCard } from '../dashboard/SafeToSpendCard';
import { HeroCard } from '../dashboard/HeroCard';
import { moneyFontVariant } from '@/theme';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

describe('plan 016 — money figures: spoken labels, wrapping, tabular figures', () => {
  it('reads the safe-to-spend headline aloud ("one thousand nine hundred ringgit")', async () => {
    const tree = await render(
      <SafeToSpendCard safeSen={190000} deficit={false} dailyAllowanceSen={6333} />,
    );
    const headline = tree.root.findByProps({ testID: 'safe-headline' });
    expect(headline.props.accessibilityLabel).toBe('Safe to spend, one thousand nine hundred ringgit');
    // Narrow-screen contract: single line, truncated with ellipsis.
    expect(headline.props.numberOfLines).toBe(1);
    const flattened = StyleSheet.flatten(headline.props.style as never) as { fontVariant?: unknown };
    expect(flattened.fontVariant).toEqual(moneyFontVariant);
  });

  it('labels the deficit headline as "No safe to spend"', async () => {
    const tree = await render(<SafeToSpendCard safeSen={-30000} deficit dailyAllowanceSen={0} />);
    const headline = tree.root.findByProps({ testID: 'safe-headline' });
    expect(headline.props.accessibilityLabel).toBe('No safe to spend, minus three hundred ringgit');
  });

  it('labels the HeroCard available/spent/remaining figures', async () => {
    const tree = await render(
      <HeroCard availableSen={300000} spentSen={116000} remainingSen={184000} onSetBudget={() => {}} />,
    );
    expect(tree.root.findByProps({ testID: 'hero-available' }).props.accessibilityLabel).toBe(
      'Available, three thousand ringgit',
    );
    expect(tree.root.findByProps({ testID: 'hero-spent' }).props.accessibilityLabel).toBe(
      'Spent this month, one thousand one hundred and sixty ringgit',
    );
    expect(tree.root.findByProps({ testID: 'hero-remaining' }).props.accessibilityLabel).toBe(
      'Remaining budget, one thousand eight hundred and forty ringgit',
    );
  });
});