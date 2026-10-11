import * as React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '@/theme';
import {
  AccountSwatch,
  BarChart,
  BentoCard,
  BreakdownRow,
  BudgetMeter,
  CategoryTile,
  Chip,
  CreditAccountCard,
  DateTile,
  DayHeader,
  DueRow,
  EmptyState,
  ExpenseRow,
  FilterPill,
  FormGroup,
  FormRow,
  Glyph,
  IconButton,
  Money,
  MoneyDisplay,
  OptionTile,
  PrimaryButton,
  ScreenTitleBlock,
  SearchField,
  SegmentedControl,
  SettingsGroup,
  SettingsRow,
  Sheet,
  StatusPill,
  Stepper,
  SummaryStrip,
  Surface,
  Switch,
  TabBar,
  TextLinkButton,
  Toast,
  TouchTarget,
  WalletStack,
} from '../index';

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  return {
    __esModule: true,
    default: {
      View: RN.View,
      createAnimatedComponent: (comp: unknown) => comp,
    },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (val: unknown) => val,
    Easing: {
      out: (fn: unknown) => fn,
      ease: (t: unknown) => t,
    },
  };
});

function findByTestId(tree: ReactTestRenderer, testID: string): ReactTestInstance {
  const matches = tree.root.findAllByProps({ testID });
  if (matches.length === 0) {
    throw new Error(`No instances found with testID: "${testID}"`);
  }
  const withStyle =
    matches.find((m) => m.props.style && typeof m.props.style !== 'function') ??
    matches[matches.length - 1];
  const withPress = matches.find((m) => typeof m.props.onPress === 'function');
  const withRole = matches.find((m) => m.props.accessibilityRole !== undefined);
  const withState = matches.find((m) => m.props.accessibilityState !== undefined);
  const withNumLines = matches.find((m) => m.props.numberOfLines !== undefined);
  const withAdjusts = matches.find((m) => m.props.adjustsFontSizeToFit !== undefined);

  return new Proxy(withStyle, {
    get(target, prop, receiver) {
      if (prop === 'props') {
        return new Proxy(target.props, {
          get(propsTarget, propsProp) {
            const val = Reflect.get(propsTarget, propsProp);
            if (val !== undefined) {
              return val;
            }
            if (propsProp === 'onPress' && withPress) {
              return withPress.props.onPress;
            }
            if (propsProp === 'accessibilityRole' && withRole) {
              return withRole.props.accessibilityRole;
            }
            if (propsProp === 'accessibilityState' && withState) {
              return withState.props.accessibilityState;
            }
            if (propsProp === 'numberOfLines' && withNumLines) {
              return withNumLines.props.numberOfLines;
            }
            if (propsProp === 'adjustsFontSizeToFit' && withAdjusts) {
              return withAdjusts.props.adjustsFontSizeToFit;
            }
            if (propsProp === 'minimumFontScale' && withAdjusts) {
              return withAdjusts.props.minimumFontScale;
            }
            if (propsProp === 'style') {
              return withStyle.props.style;
            }
            return undefined;
          },
        });
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 40, left: 0, right: 0, bottom: 20 },
          frame: { x: 0, y: 0, width: 354, height: 792 },
        }}
      >
        {element}
      </SafeAreaProvider>
    );
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

describe('Wave 1A — UI Foundation Primitives (design.jsonc)', () => {
  describe('Glyph', () => {
    it('renders all required glyphs without throwing', async () => {
      const glyphs = [
        'home',
        'expenses',
        'due',
        'analytics',
        'plus',
        'ai',
        'settings',
        'search',
        'back',
        'chevron',
      ] as const;

      for (const name of glyphs) {
        const tree = await render(
          <ThemeProvider>
            <Glyph name={name} testID={`glyph-${name}`} />
          </ThemeProvider>
        );
        expect(tree.root.findByProps({ testID: `glyph-${name}` })).toBeDefined();
      }
    });
  });

  describe('IconButton', () => {
    it('renders 44dp circular touch target with accessibility role', async () => {
      const onPress = jest.fn();
      const tree = await render(
        <ThemeProvider>
          <IconButton
            name="settings"
            accessibilityLabel="Settings"
            onPress={onPress}
            testID="icon-btn"
          />
        </ThemeProvider>
      );
      const btn = findByTestId(tree, 'icon-btn');
      expect(btn.props.accessibilityRole).toBe('button');
      expect(btn.props.accessibilityLabel).toBe('Settings');
      const style = StyleSheet.flatten(btn.props.style) as { width: number; height: number };
      expect(style.width).toBe(44);
      expect(style.height).toBe(44);

      await act(async () => {
        btn.props.onPress();
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('PrimaryButton', () => {
    it('renders primary variant with 52dp height and radius 14dp', async () => {
      const onPress = jest.fn();
      const tree = await render(
        <ThemeProvider>
          <PrimaryButton title="Save expense" onPress={onPress} testID="btn-primary" />
        </ThemeProvider>
      );
      const btn = findByTestId(tree, 'btn-primary');
      const style = StyleSheet.flatten(btn.props.style) as { height: number; borderRadius: number };
      expect(style.height).toBe(52);
      expect(style.borderRadius).toBe(14);

      await act(async () => {
        btn.props.onPress();
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('supports secondary variant', async () => {
      const tree = await render(
        <ThemeProvider>
          <PrimaryButton title="Cancel" variant="secondary" testID="btn-secondary" />
        </ThemeProvider>
      );
      const btn = findByTestId(tree, 'btn-secondary');
      expect(btn).toBeDefined();
    });
  });

  describe('TextLinkButton', () => {
    it('enforces min 44dp touch target and handles press', async () => {
      const onPress = jest.fn();
      const tree = await render(
        <ThemeProvider>
          <TextLinkButton label="See all" onPress={onPress} testID="link-btn" />
        </ThemeProvider>
      );
      const btn = findByTestId(tree, 'link-btn');
      const style = StyleSheet.flatten(btn.props.style) as { minHeight: number; minWidth: number };
      expect(style.minHeight).toBe(44);
      expect(style.minWidth).toBe(44);

      await act(async () => {
        btn.props.onPress();
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Chip', () => {
    it('renders 36dp pill chip with selected and unselected states', async () => {
      const onPress = jest.fn();
      const tree = await render(
        <ThemeProvider>
          <Chip label="Food" selected onPress={onPress} testID="chip-selected" />
          <Chip label="Transport" selected={false} onPress={onPress} testID="chip-unselected" />
        </ThemeProvider>
      );

      const sel = findByTestId(tree, 'chip-selected');
      const styleSel = StyleSheet.flatten(sel.props.style) as { height: number; borderRadius: number };
      expect(styleSel.height).toBe(36);
      expect(styleSel.borderRadius).toBe(18);

      const unsel = findByTestId(tree, 'chip-unselected');
      const styleUnsel = StyleSheet.flatten(unsel.props.style) as { height: number };
      expect(styleUnsel.height).toBe(36);

      await act(async () => {
        sel.props.onPress();
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders dashed variant for + Add category', async () => {
      const tree = await render(
        <ThemeProvider>
          <Chip label="+ Add" dashed testID="chip-dashed" />
        </ThemeProvider>
      );
      const chip = findByTestId(tree, 'chip-dashed');
      const style = StyleSheet.flatten(chip.props.style) as { borderStyle: string };
      expect(style.borderStyle).toBe('dashed');
    });
  });

  describe('FilterPill', () => {
    it('renders 32dp pill with 12dp horizontal padding', async () => {
      const tree = await render(
        <ThemeProvider>
          <FilterPill label="This month" selected testID="pill-1" />
        </ThemeProvider>
      );
      const pill = findByTestId(tree, 'pill-1');
      const style = StyleSheet.flatten(pill.props.style) as { height: number; paddingHorizontal: number };
      expect(style.height).toBe(32);
      expect(style.paddingHorizontal).toBe(12);
    });
  });

  describe('SegmentedControl', () => {
    it('renders accessible radiogroup with segments', async () => {
      const onChange = jest.fn();
      const options = [
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ];
      const tree = await render(
        <ThemeProvider>
          <SegmentedControl
            options={options}
            value="month"
            onChange={onChange}
            testID="segment"
          />
        </ThemeProvider>
      );
      const container = findByTestId(tree, 'segment');
      expect(container.props.accessibilityRole).toBe('radiogroup');

      const daySegment = findByTestId(tree, 'segment-day');
      expect(daySegment.props.accessibilityRole).toBe('radio');

      await act(async () => {
        daySegment.props.onPress();
      });
      expect(onChange).toHaveBeenCalledWith('day');
    });
  });

  describe('Switch', () => {
    it('renders 51x31dp track with accessible switch role', async () => {
      const onValueChange = jest.fn();
      const tree = await render(
        <ThemeProvider>
          <Switch value={false} onValueChange={onValueChange} testID="switch" />
        </ThemeProvider>
      );
      const sw = findByTestId(tree, 'switch');
      expect(sw.props.accessibilityRole).toBe('switch');
      expect(sw.props.accessibilityState.checked).toBe(false);

      const style = StyleSheet.flatten(sw.props.style) as { width: number; height: number };
      expect(style.width).toBe(51);
      expect(style.height).toBe(31);

      await act(async () => {
        sw.props.onPress();
      });
      expect(onValueChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Stepper', () => {
    it('renders [−] value [+] with 44x40dp buttons and modifies value', async () => {
      const onChange = jest.fn();
      const tree = await render(
        <ThemeProvider>
          <Stepper value={1.5} onChange={onChange} testID="stepper" />
        </ThemeProvider>
      );
      const incBtn = findByTestId(tree, 'stepper-increase');
      const decBtn = findByTestId(tree, 'stepper-decrease');

      const incStyle = StyleSheet.flatten(incBtn.props.style) as { width: number; height: number };
      expect(incStyle.width).toBe(44);
      expect(incStyle.height).toBe(40);

      await act(async () => {
        incBtn.props.onPress();
      });
      expect(onChange).toHaveBeenCalledWith(2.0);

      await act(async () => {
        decBtn.props.onPress();
      });
      expect(onChange).toHaveBeenCalledWith(1.0);
    });
  });

  describe('OptionTile', () => {
    it('renders min 48dp tile with swatch, name, kind, and selection state', async () => {
      const onPress = jest.fn();
      const tree = await render(
        <ThemeProvider>
          <OptionTile
            name="Savings"
            kind="Bank"
            accountType="bank"
            selected
            onPress={onPress}
            testID="opt-tile"
          />
        </ThemeProvider>
      );
      const tile = findByTestId(tree, 'opt-tile');
      const style = StyleSheet.flatten(tile.props.style) as { minHeight: number; borderRadius: number };
      expect(style.minHeight).toBe(48);
      expect(style.borderRadius).toBe(12);

      await act(async () => {
        tile.props.onPress();
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Surface', () => {
    it('renders surface with 16dp radius', async () => {
      const tree = await render(
        <ThemeProvider>
          <Surface testID="surface">
            <Text>Panel</Text>
          </Surface>
        </ThemeProvider>
      );
      const surface = findByTestId(tree, 'surface');
      const style = StyleSheet.flatten(surface.props.style) as { borderRadius: number };
      expect(style.borderRadius).toBe(16);
    });
  });

  describe('FormGroup & FormRow', () => {
    it('renders 14dp radius surface with min 48dp rows', async () => {
      const tree = await render(
        <ThemeProvider>
          <FormGroup testID="form-group">
            <FormRow label="Date" value="Today, 10 Oct" testID="row-1" />
            <FormRow label="Note" value="Lunch" isLast testID="row-2" />
          </FormGroup>
        </ThemeProvider>
      );
      const group = findByTestId(tree, 'form-group');
      const groupStyle = StyleSheet.flatten(group.props.style) as { borderRadius: number };
      expect(groupStyle.borderRadius).toBe(14);

      const row = findByTestId(tree, 'row-1');
      const rowStyle = StyleSheet.flatten(row.props.style) as { minHeight: number };
      expect(rowStyle.minHeight).toBe(48);
    });
  });

  describe('SettingsGroup & SettingsRow', () => {
    it('renders sectionCaps header, 48dp/56dp rows with chevron, and footnote', async () => {
      const tree = await render(
        <ThemeProvider>
          <SettingsGroup
            title="Appearance"
            footnote="Follows your phone's dark-mode setting."
            testID="settings-grp"
          >
            <SettingsRow label="Theme" value="Dark" chevron testID="settings-row" />
          </SettingsGroup>
        </ThemeProvider>
      );
      const row = findByTestId(tree, 'settings-row');
      const rowStyle = StyleSheet.flatten(row.props.style) as { minHeight: number };
      expect(rowStyle.minHeight).toBe(48);
    });
  });

  describe('SearchField', () => {
    it('renders 40dp field with 10dp radius and handles text change', async () => {
      const onChangeText = jest.fn();
      const tree = await render(
        <ThemeProvider>
          <SearchField
            value=""
            onChangeText={onChangeText}
            placeholder="Search notes"
            testID="search"
          />
        </ThemeProvider>
      );
      const search = findByTestId(tree, 'search');
      const style = StyleSheet.flatten(search.props.style) as { height: number; borderRadius: number };
      expect(style.height).toBe(40);
      expect(style.borderRadius).toBe(10);
    });
  });

  describe('DateTile', () => {
    it('renders 40x40dp tile with day 15/700 and uppercase month 9/600', async () => {
      const tree = await render(
        <ThemeProvider>
          <DateTile day={15} month="Oct" testID="date-tile" />
        </ThemeProvider>
      );
      const tile = findByTestId(tree, 'date-tile');
      const style = StyleSheet.flatten(tile.props.style) as { width: number; height: number; borderRadius: number };
      expect(style.width).toBe(40);
      expect(style.height).toBe(40);
      expect(style.borderRadius).toBe(10);

      const texts = tree.root.findAllByType(Text);
      expect(texts[0].props.children).toBe(15);
      expect(texts[1].props.children).toBe('OCT');
    });
  });

  describe('CategoryTile', () => {
    it('renders 34x34dp tile with radius 9 in dark and light themes', async () => {
      const darkTree = await render(
        <ThemeProvider initialMode="dark">
          <CategoryTile categoryIndex={1} testID="cat-dark" />
        </ThemeProvider>
      );
      const darkTile = findByTestId(darkTree, 'cat-dark');
      const darkStyle = StyleSheet.flatten(darkTile.props.style) as { width: number; height: number; borderRadius: number };
      expect(darkStyle.width).toBe(34);
      expect(darkStyle.height).toBe(34);
      expect(darkStyle.borderRadius).toBe(9);

      const lightTree = await render(
        <ThemeProvider initialMode="light">
          <CategoryTile categoryIndex={1} testID="cat-light" />
        </ThemeProvider>
      );
      const lightTile = findByTestId(lightTree, 'cat-light');
      expect(lightTile).toBeDefined();
    });
  });

  describe('AccountSwatch', () => {
    it('renders default (22x15) and settings (30x20) variants', async () => {
      const tree = await render(
        <ThemeProvider>
          <AccountSwatch accountType="bank" testID="swatch-def" />
          <AccountSwatch accountType="cash" variant="settings" testID="swatch-set" />
        </ThemeProvider>
      );

      const def = findByTestId(tree, 'swatch-def');
      const defStyle = StyleSheet.flatten(def.props.style) as { width: number; height: number; borderRadius: number };
      expect(defStyle.width).toBe(22);
      expect(defStyle.height).toBe(15);
      expect(defStyle.borderRadius).toBe(3);

      const set = findByTestId(tree, 'swatch-set');
      const setStyle = StyleSheet.flatten(set.props.style) as { width: number; height: number; borderRadius: number };
      expect(setStyle.width).toBe(30);
      expect(setStyle.height).toBe(20);
      expect(setStyle.borderRadius).toBe(4);
    });
  });

  describe('DueRow', () => {
    it('renders min 52dp row with non-wrapping amount', async () => {
      const tree = await render(
        <ThemeProvider>
          <DueRow
            day={31}
            month="Oct"
            name="SPayLater · October bill"
            meta="Closed 20 Oct · 9 purchases"
            amount="RM412.50"
            testID="due-row"
          />
        </ThemeProvider>
      );
      const row = findByTestId(tree, 'due-row');
      const style = StyleSheet.flatten(row.props.style) as { minHeight: number };
      expect(style.minHeight).toBe(52);

      const amountText = tree.root.findByProps({ children: 'RM412.50' });
      expect(amountText.props.numberOfLines).toBe(1);
      expect(amountText.props.adjustsFontSizeToFit).toBe(true);
      expect(amountText.props.minimumFontScale).toBe(0.7);
    });

    it('renders 60dp row when progress is present', async () => {
      const tree = await render(
        <ThemeProvider>
          <DueRow
            day={15}
            month="Oct"
            name="Car loan"
            meta="Instalment 12 of 60"
            amount="RM650.00"
            progress={20}
            testID="due-progress-row"
          />
        </ThemeProvider>
      );
      const row = findByTestId(tree, 'due-progress-row');
      const style = StyleSheet.flatten(row.props.style) as { minHeight: number };
      expect(style.minHeight).toBe(60);
    });
  });

  describe('ExpenseRow', () => {
    it('renders min 52dp row with CategoryTile, note, meta, and non-wrapping amount', async () => {
      const tree = await render(
        <ThemeProvider>
          <ExpenseRow
            categoryName="Food"
            note="Lunch"
            meta="Food · Savings"
            amount="RM18.50"
            testID="expense-row"
          />
        </ThemeProvider>
      );
      const row = findByTestId(tree, 'expense-row');
      const style = StyleSheet.flatten(row.props.style) as { minHeight: number };
      expect(style.minHeight).toBe(52);

      const amountText = tree.root.findByProps({ children: 'RM18.50' });
      expect(amountText.props.numberOfLines).toBe(1);
      expect(amountText.props.adjustsFontSizeToFit).toBe(true);
      expect(amountText.props.minimumFontScale).toBe(0.7);
    });
  });

  describe('DayHeader', () => {
    it('renders sectionCaps uppercase title and space-between day total', async () => {
      const tree = await render(
        <ThemeProvider>
          <DayHeader title="Today · Fri 10 Oct" total="RM58.40" testID="day-header" />
        </ThemeProvider>
      );
      const texts = tree.root.findAllByType(Text);
      expect(texts[0].props.children).toBe('TODAY · FRI 10 OCT');
      expect(texts[1].props.children).toBe('RM58.40');
    });
  });

  describe('BreakdownRow', () => {
    it('renders name, pct, amount, and progress bar', async () => {
      const tree = await render(
        <ThemeProvider>
          <BreakdownRow name="Food" pct={34} amount="RM134.60" testID="breakdown-row" />
        </ThemeProvider>
      );
      const row = findByTestId(tree, 'breakdown-row');
      expect(row).toBeDefined();
      const texts = tree.root.findAllByType(Text);
      const pctText = texts.find((t) => {
        const c = t.props.children;
        return (Array.isArray(c) ? c.join('') : String(c)).includes('34%');
      });
      expect(pctText).toBeDefined();
    });
  });

  describe('Sheet', () => {
    it('renders bottom sheet modal with 20dp top radius and handle', async () => {
      const onClose = jest.fn();
      const tree = await render(
        <ThemeProvider>
          <Sheet visible onClose={onClose} cardTestID="sheet-card">
            <Text>Sheet content</Text>
          </Sheet>
        </ThemeProvider>
      );
      const card = findByTestId(tree, 'sheet-card');
      const style = StyleSheet.flatten(card.props.style) as { borderTopLeftRadius: number };
      expect(style.borderTopLeftRadius).toBe(20);
    });
  });

  describe('Toast', () => {
    it('renders pill with inverted colors and alert accessibility role', async () => {
      const tree = await render(
        <ThemeProvider>
          <Toast message="Saved successfully" testID="toast" />
        </ThemeProvider>
      );
      const toast = findByTestId(tree, 'toast');
      expect(toast.props.accessibilityRole).toBe('alert');
      const style = StyleSheet.flatten(toast.props.style) as { borderRadius: number };
      expect(style.borderRadius).toBe(9999);
    });
  });

  describe('EmptyState', () => {
    it('renders 1-line headline, 1-line caption, and optional button', async () => {
      const onBtn = jest.fn();
      const tree = await render(
        <ThemeProvider>
          <EmptyState
            headline="No commitments due"
            caption="All upcoming bills are paid."
            buttonLabel="Add commitment"
            onButtonPress={onBtn}
            testID="empty"
          />
        </ThemeProvider>
      );
      const headline = tree.root.findByProps({ children: 'No commitments due' });
      expect(headline.props.numberOfLines).toBe(1);

      const caption = tree.root.findByProps({ children: 'All upcoming bills are paid.' });
      expect(caption.props.numberOfLines).toBe(1);
    });
  });

  describe('BarChart', () => {
    it('renders svg presentational chart with 168dp height and selectable bars', async () => {
      const onSelect = jest.fn();
      const bars = [
        { label: 'Jan', valueSen: 10000 },
        { label: 'Feb', valueSen: 25000 },
        { label: 'Mar', valueSen: 15000 },
      ];
      const tree = await render(
        <ThemeProvider>
          <BarChart bars={bars} onSelectBar={onSelect} testID="chart" />
        </ThemeProvider>
      );
      const febBar = tree.root.findByProps({ testID: 'chart-bar-1' });
      expect(febBar).toBeDefined();

      await act(async () => {
        febBar.props.onPress();
      });
      expect(onSelect).toHaveBeenCalledWith(1);
    });
  });

  describe('WalletCard & WalletStack', () => {
    it('renders collapsed card at 76dp and stacks with -18dp overlap', async () => {
      const cards = [
        {
          id: 'bank',
          name: 'Savings',
          kind: 'Bank',
          amount: 'RM3,912.40',
          amountLabel: 'Balance',
          accountType: 'bank' as const,
        },
        {
          id: 'cash',
          name: 'Cash',
          kind: 'Wallet',
          amount: 'RM395.30',
          amountLabel: 'Balance',
          accountType: 'cash' as const,
        },
      ];

      const tree = await render(
        <ThemeProvider>
          <WalletStack cards={cards} availableAmount="RM4,307.70" testID="stack" />
        </ThemeProvider>
      );

      const card1 = findByTestId(tree, 'stack-card-bank');
      const style1 = StyleSheet.flatten(card1.props.style) as { marginTop: number };
      expect(style1.marginTop).toBe(0);

      const card2 = findByTestId(tree, 'stack-card-cash');
      const style2 = StyleSheet.flatten(card2.props.style) as { marginTop: number };
      expect(style2.marginTop).toBe(-18);
    });
  });

  describe('CreditAccountCard', () => {
    it('renders credit account card with Pay pill on unpaid bill and Paid pill on paid bill', async () => {
      const onPay = jest.fn();
      const account = {
        name: 'SPayLater',
        type: 'paylater' as const,
        cycleText: 'Cycle 21st–20th · due end of month',
        owedText: 'RM498.50',
      };
      const bills = [
        {
          id: 'oct',
          title: 'October bill',
          meta: 'Closed 20 Oct · 9 purchases',
          amountText: 'RM412.50',
          status: 'unpaid' as const,
        },
        {
          id: 'sep',
          title: 'September bill',
          meta: 'Paid 10 Oct · Savings',
          amountText: 'RM350.00',
          status: 'paid' as const,
        },
      ];

      const tree = await render(
        <ThemeProvider>
          <CreditAccountCard account={account} bills={bills} onPay={onPay} testID="credit-card" />
        </ThemeProvider>
      );

      const payBtn = findByTestId(tree, 'credit-card-pay-oct');
      expect(payBtn).toBeDefined();

      await act(async () => {
        payBtn.props.onPress();
      });
      expect(onPay).toHaveBeenCalledWith('oct');

      const paidText = tree.root.findByProps({ children: 'Paid' });
      expect(paidText).toBeDefined();
    });
  });

  describe('TabBar', () => {
    it('renders 5 columns with center 48dp action button and fires callbacks', async () => {
      const onNav = jest.fn();
      const onAction = jest.fn();

      const tree = await render(
        <ThemeProvider>
          <TabBar currentRoute="index" onNavigate={onNav} onActionPress={onAction} testID="tabbar" />
        </ThemeProvider>
      );

      const expensesTab = findByTestId(tree, 'tabbar-tab-expenses');
      await act(async () => {
        expensesTab.props.onPress();
      });
      expect(onNav).toHaveBeenCalledWith('expenses');

      const actionBtn = findByTestId(tree, 'tabbar-action-plus');
      const actionStyle = StyleSheet.flatten(actionBtn.props.style) as { width: number; height: number };
      expect(actionStyle.width).toBe(48);
      expect(actionStyle.height).toBe(48);

      await act(async () => {
        actionBtn.props.onPress();
      });
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('ScreenTitleBlock', () => {
    it('renders caption above largeTitle', async () => {
      const tree = await render(
        <ThemeProvider>
          <ScreenTitleBlock title="October" caption="Friday, 10 October" testID="title-block" />
        </ThemeProvider>
      );
      const title = tree.root.findByProps({ children: 'October' });
      expect(title).toBeDefined();
      const caption = tree.root.findByProps({ children: 'Friday, 10 October' });
      expect(caption).toBeDefined();
    });
  });

  describe('SummaryStrip', () => {
    it('renders Home 2 equal columns with emphasis on due amount', async () => {
      const tree = await render(
        <ThemeProvider>
          <SummaryStrip
            spentAmount="RM396.00"
            spentMeta="12 expenses"
            dueAmount="RM1,187.50"
            dueMeta="3 to pay"
            testID="home-strip"
          />
        </ThemeProvider>
      );
      const strip = findByTestId(tree, 'home-strip');
      expect(strip).toBeDefined();
    });

    it('renders Due 1 row variant', async () => {
      const tree = await render(
        <ThemeProvider>
          <SummaryStrip
            variant="due"
            dueLabel="Due by 31 Oct"
            dueAmount="RM1,187.50"
            nextLabel="November so far"
            nextAmount="RM1,536.00"
            testID="due-strip"
          />
        </ThemeProvider>
      );
      const strip = findByTestId(tree, 'due-strip');
      expect(strip).toBeDefined();
    });
  });

  describe('Money', () => {
    it('formats sen to RM with tabular-nums and non-wrapping style', async () => {
      const tree = await render(
        <ThemeProvider>
          <Money amountInSen={123450} size="hero" testID="money-hero" />
        </ThemeProvider>
      );
      const el = findByTestId(tree, 'money-hero');
      expect(el.props.numberOfLines).toBe(1);
      expect(el.props.adjustsFontSizeToFit).toBe(true);
      expect(el.props.minimumFontScale).toBe(0.7);

      const style = StyleSheet.flatten(el.props.style) as { fontSize: number; fontVariant: string[] };
      expect(style.fontSize).toBe(44);
      expect(style.fontVariant).toEqual(['tabular-nums']);
    });
  });
});

