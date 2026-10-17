/**
 * Plan 016 — money figure accessibility: spoken accessibilityLabels on the key
 * figures and (under the ios jest preset) tabular figures. Plan 020 replaced
 * the safe-to-spend / hero figures with Home's month summary.
 */
import { describe, expect, it } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Money } from '@/components/ui/Money';
import { moneyFontVariant } from '@/theme';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

describe('plan 016 — money figures: spoken labels, tabular figures', () => {
  it('reads money figures aloud with tabular figures', async () => {
    const tree = await render(
      <Money amountInSen={116000} testID="test-money" />
    );
    const host = tree.root.find(
      (node) => typeof node.type === 'string' && node.props.testID === 'test-money'
    );
    expect(host.props.accessibilityLabel).toBe('one thousand one hundred and sixty ringgit');
    const flattened = StyleSheet.flatten(host.props.style as never) as { fontVariant?: unknown };
    expect(flattened.fontVariant).toEqual(moneyFontVariant);
  });
});
