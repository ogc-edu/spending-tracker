import * as React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  BentoCard,
  BudgetMeter,
  MoneyDisplay,
  StatusPill,
  TouchTarget,
} from '../index';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

describe('Plan 002 — Reusable UI Component Primitives', () => {
  describe('MoneyDisplay', () => {
    it('formats basic integer sen with Malaysian Ringgit prefix and 2 decimals', async () => {
      const tree = await render(<MoneyDisplay amountInSen={190000} testID="money-1" />);
      const text = tree.root.findByType(Text);
      const content = Array.isArray(text.props.children)
        ? text.props.children.join('')
        : String(text.props.children);
      expect(content).toBe('RM1,900.00');
    });

    it('pads single-digit cents correctly', async () => {
      const tree = await render(<MoneyDisplay amountInSen={5} testID="money-cents" />);
      const text = tree.root.findByType(Text);
      const content = Array.isArray(text.props.children)
        ? text.props.children.join('')
        : String(text.props.children);
      expect(content).toBe('RM0.05');
    });

    it('formats zero sen cleanly', async () => {
      const tree = await render(<MoneyDisplay amountInSen={0} testID="money-zero" />);
      const text = tree.root.findByType(Text);
      const content = Array.isArray(text.props.children)
        ? text.props.children.join('')
        : String(text.props.children);
      expect(content).toBe('RM0.00');
    });

    it('formats negative amounts with minus sign', async () => {
      const tree = await render(<MoneyDisplay amountInSen={-15000} testID="money-neg" />);
      const text = tree.root.findByType(Text);
      const content = Array.isArray(text.props.children)
        ? text.props.children.join('')
        : String(text.props.children);
      expect(content).toBe('-RM150.00');
    });

    it('adds + trend prefix for positive values when trendPrefix is true', async () => {
      const tree = await render(
        <MoneyDisplay amountInSen={250000} trendPrefix testID="money-pos-trend" />
      );
      const text = tree.root.findByType(Text);
      const content = Array.isArray(text.props.children)
        ? text.props.children.join('')
        : String(text.props.children);
      expect(content).toBe('+RM2,500.00');
    });

    it('preserves - prefix for negative values when trendPrefix is true', async () => {
      const tree = await render(
        <MoneyDisplay amountInSen={-4500} trendPrefix testID="money-neg-trend" />
      );
      const text = tree.root.findByType(Text);
      const content = Array.isArray(text.props.children)
        ? text.props.children.join('')
        : String(text.props.children);
      expect(content).toBe('-RM45.00');
    });

    it('does not add + prefix for zero when trendPrefix is true', async () => {
      const tree = await render(
        <MoneyDisplay amountInSen={0} trendPrefix testID="money-zero-trend" />
      );
      const text = tree.root.findByType(Text);
      const content = Array.isArray(text.props.children)
        ? text.props.children.join('')
        : String(text.props.children);
      expect(content).toBe('RM0.00');
    });

    it('applies tabular-nums fontVariant for monospaced numeric layout', async () => {
      const tree = await render(<MoneyDisplay amountInSen={1234} testID="money-tabular" />);
      const text = tree.root.findByType(Text);
      const flattened = StyleSheet.flatten(text.props.style as never) as {
        fontVariant?: string[];
      };
      expect(flattened.fontVariant).toEqual(['tabular-nums']);
    });

    it('applies size classes appropriately', async () => {
      const treeHero = await render(
        <MoneyDisplay amountInSen={10000} size="hero" testID="money-hero" />
      );
      const heroText = treeHero.root.findByType(Text);
      expect(heroText.props.className).toContain('text-4xl');

      const treeXs = await render(
        <MoneyDisplay amountInSen={10000} size="xs" testID="money-xs" />
      );
      const xsText = treeXs.root.findByType(Text);
      expect(xsText.props.className).toContain('text-xs');
    });

    it('dims the cents portion when dimCents is true', async () => {
      const tree = await render(
        <MoneyDisplay amountInSen={190050} dimCents testID="money-dimmed" />
      );
      const centsEl = tree.root.findByProps({ testID: 'money-dimmed-cents' });
      expect(centsEl.props.className).toContain('opacity-60');
      expect(centsEl.props.children).toBe('.50');
    });

    it('exposes spoken accessibility labels', async () => {
      const tree = await render(<MoneyDisplay amountInSen={190000} testID="money-a11y" />);
      const text = tree.root.findByType(Text);
      expect(text.props.accessibilityLabel).toBe(
        'one thousand nine hundred ringgit'
      );

      const treeWithTrend = await render(
        <MoneyDisplay amountInSen={190000} trendPrefix testID="money-a11y-trend" />
      );
      const trendText = treeWithTrend.root.findByType(Text);
      expect(trendText.props.accessibilityLabel).toBe(
        'plus one thousand nine hundred ringgit'
      );
    });
  });

  describe('StatusPill', () => {
    it('renders label and healthy variant classes', async () => {
      const tree = await render(
        <StatusPill variant="healthy" label="Healthy Surplus" testID="pill-healthy" />
      );
      const pill = tree.root.findByType(View);
      expect(pill.props.className).toContain('bg-emerald-500/10');
      expect(pill.props.className).toContain('border-emerald-500/30');

      const label = tree.root.findByProps({ testID: 'pill-healthy-label' });
      expect(label.props.children).toBe('Healthy Surplus');
      expect(label.props.className).toContain('text-emerald-700');
    });

    it('renders warning and danger variants correctly', async () => {
      const treeWarn = await render(
        <StatusPill variant="warning" label="Tight Margin" testID="pill-warn" />
      );
      expect(treeWarn.root.findByType(View).props.className).toContain(
        'bg-amber-500/10'
      );

      const treeDanger = await render(
        <StatusPill variant="danger" label="Deficit" testID="pill-danger" />
      );
      expect(treeDanger.root.findByType(View).props.className).toContain(
        'bg-rose-500/10'
      );
    });

    it('renders dot indicator when dot is true', async () => {
      const tree = await render(
        <StatusPill variant="accent" label="Active" dot testID="pill-dot" />
      );
      const dotEl = tree.root.findByProps({ testID: 'pill-dot-dot' });
      expect(dotEl.props.className).toContain('bg-cyan-500');
      expect(dotEl.props.className).toContain('rounded-full');
    });

    it('omits dot indicator by default', async () => {
      const tree = await render(
        <StatusPill variant="neutral" label="Neutral" testID="pill-no-dot" />
      );
      expect(tree.root.findAllByProps({ testID: 'pill-no-dot-dot' })).toHaveLength(0);
    });

    it('exposes accessibility role text and label', async () => {
      const tree = await render(
        <StatusPill variant="healthy" label="All Good" testID="pill-a11y" />
      );
      const pill = tree.root.findByType(View);
      expect(pill.props.accessibilityRole).toBe('text');
      expect(pill.props.accessibilityLabel).toBe('All Good');
    });
  });

  describe('BudgetMeter', () => {
    it('calculates percentage and applies bg-primary when spent < 80%', async () => {
      const tree = await render(
        <BudgetMeter spentSen={50000} totalSen={100000} testID="meter-healthy" />
      );
      const bar = tree.root.findByProps({ testID: 'meter-healthy-bar' });
      expect(bar.props.className).toContain('bg-primary');
      const flattened = StyleSheet.flatten(bar.props.style as never) as { width: string };
      expect(flattened.width).toBe('50%');
    });

    it('shifts to bg-warning when spent is between 80% and 99%', async () => {
      const tree = await render(
        <BudgetMeter spentSen={85000} totalSen={100000} testID="meter-warning" />
      );
      const bar = tree.root.findByProps({ testID: 'meter-warning-bar' });
      expect(bar.props.className).toContain('bg-warning');
      const flattened = StyleSheet.flatten(bar.props.style as never) as { width: string };
      expect(flattened.width).toBe('85%');
    });

    it('shifts to bg-destructive and clamps bar width to 100% when spent >= 100%', async () => {
      const tree = await render(
        <BudgetMeter spentSen={120000} totalSen={100000} testID="meter-over" />
      );
      const bar = tree.root.findByProps({ testID: 'meter-over-bar' });
      expect(bar.props.className).toContain('bg-destructive');
      const flattened = StyleSheet.flatten(bar.props.style as never) as { width: string };
      expect(flattened.width).toBe('100%');
    });

    it('clamps negative spent to 0%', async () => {
      const tree = await render(
        <BudgetMeter spentSen={-1000} totalSen={100000} testID="meter-neg" />
      );
      const bar = tree.root.findByProps({ testID: 'meter-neg-bar' });
      const flattened = StyleSheet.flatten(bar.props.style as never) as { width: string };
      expect(flattened.width).toBe('0%');
    });

    it('handles totalSen = 0 gracefully', async () => {
      const tree = await render(
        <BudgetMeter spentSen={5000} totalSen={0} testID="meter-zero-budget" />
      );
      const bar = tree.root.findByProps({ testID: 'meter-zero-budget-bar' });
      expect(bar.props.className).toContain('bg-destructive');
      const flattened = StyleSheet.flatten(bar.props.style as never) as { width: string };
      expect(flattened.width).toBe('100%');
    });

    it('supports custom color class or style', async () => {
      const treeClass = await render(
        <BudgetMeter
          spentSen={50000}
          totalSen={100000}
          customColor="bg-purple-500"
          testID="meter-custom-class"
        />
      );
      const barClass = treeClass.root.findByProps({ testID: 'meter-custom-class-bar' });
      expect(barClass.props.className).toContain('bg-purple-500');

      const treeHex = await render(
        <BudgetMeter
          spentSen={50000}
          totalSen={100000}
          customColor="#8B5CF6"
          testID="meter-custom-hex"
        />
      );
      const barHex = treeHex.root.findByProps({ testID: 'meter-custom-hex-bar' });
      const flattened = StyleSheet.flatten(barHex.props.style as never) as {
        backgroundColor: string;
      };
      expect(flattened.backgroundColor).toBe('#8B5CF6');
    });

    it('supports custom heightClass', async () => {
      const tree = await render(
        <BudgetMeter
          spentSen={1000}
          totalSen={5000}
          heightClass="h-4"
          testID="meter-height"
        />
      );
      const container = tree.root.findAllByType(View)[0];
      expect(container.props.className).toContain('h-4');
    });

    it('exposes progressbar accessibility role and values', async () => {
      const tree = await render(
        <BudgetMeter spentSen={30000} totalSen={100000} testID="meter-a11y" />
      );
      const container = tree.root.findAllByType(View)[0];
      expect(container.props.accessibilityRole).toBe('progressbar');
      expect(container.props.accessibilityValue).toEqual({
        min: 0,
        max: 100,
        now: 30,
      });
      expect(container.props.accessibilityLabel).toBe('Budget progress: 30%');
    });
  });

  describe('BentoCard', () => {
    it('renders container with base hairline borders and rounded-2xl', async () => {
      const tree = await render(
        <BentoCard testID="bento-base">
          <Text testID="bento-child">Content</Text>
        </BentoCard>
      );
      const card = tree.root.findByType(View);
      expect(card.props.className).toContain('rounded-2xl');
      expect(card.props.className).toContain('border-border/60');
      expect(card.props.className).toContain('bg-card');
      expect(tree.root.findByProps({ testID: 'bento-child' }).props.children).toBe(
        'Content'
      );
    });

    it('applies elevated styling when elevated is true', async () => {
      const tree = await render(
        <BentoCard elevated testID="bento-elevated">
          <View />
        </BentoCard>
      );
      const card = tree.root.findAllByType(View)[0];
      expect(card.props.className).toContain('border-border/80');
      expect(card.props.className).toContain('shadow-sm');
    });
  });

  describe('TouchTarget', () => {
    it('enforces minimum 44px hit target boundaries by default', async () => {
      const tree = await render(
        <TouchTarget testID="touch-default">
          <Text>Tap</Text>
        </TouchTarget>
      );
      const target = tree.root.findByProps({ accessibilityRole: 'button' });
      const styleFn = target.props.style as (state: { pressed: boolean }) => unknown;
      const flattened = StyleSheet.flatten(styleFn({ pressed: false })) as {
        minHeight: number;
        minWidth: number;
      };
      expect(flattened.minHeight).toBe(44);
      expect(flattened.minWidth).toBe(44);
      expect(target.props.accessibilityRole).toBe('button');
    });

    it('allows custom minHeight (e.g. 48px)', async () => {
      const tree = await render(
        <TouchTarget minHeight={48} testID="touch-48">
          <Text>Tap</Text>
        </TouchTarget>
      );
      const target = tree.root.findByProps({ accessibilityRole: 'button' });
      const styleFn = target.props.style as (state: { pressed: boolean }) => unknown;
      const flattened = StyleSheet.flatten(styleFn({ pressed: false })) as {
        minHeight: number;
        minWidth: number;
      };
      expect(flattened.minHeight).toBe(48);
      expect(flattened.minWidth).toBe(48);
    });

    it('dispatches onPress events when pressed', async () => {
      const onPress = jest.fn();
      const tree = await render(
        <TouchTarget onPress={onPress} testID="touch-press">
          <Text>Tap</Text>
        </TouchTarget>
      );
      const target = tree.root.findByProps({ accessibilityRole: 'button' });
      await act(async () => {
        target.props.onPress();
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
