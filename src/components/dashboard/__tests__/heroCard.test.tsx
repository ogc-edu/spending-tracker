/**
 * HeroCard — the available-balance privacy toggle. The eye button masks the
 * headline with asterisks (and only the headline: spent and remaining budget
 * stay visible), flips its icon and its accessibility label, and reveals the
 * amount again on a second tap. Nothing is persisted — it is a view state.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { HeroCard } from '../HeroCard';

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <HeroCard availableSen={300_000} spentSen={116_000} remainingSen={184_000} onSetBudget={jest.fn()} />,
    );
  });
  return tree;
}

function textOf(tree: ReactTestRenderer, testID: string): string {
  const node = tree.root.findAllByProps({ testID }).slice(-1)[0];
  const texts: string[] = [];
  const collect = (instance: ReactTestInstance): void => {
    for (const child of instance.children) {
      if (typeof child === 'string') texts.push(child);
      else collect(child);
    }
  };
  collect(node);
  return texts.join('');
}

function toggle(tree: ReactTestRenderer): ReactTestInstance {
  return tree.root.findByProps({ testID: 'hero-available-toggle' });
}

async function press(tree: ReactTestRenderer): Promise<void> {
  await act(async () => {
    (toggle(tree).props as { onPress(): void }).onPress();
  });
}

describe('HeroCard — hide the available balance', () => {
  it('shows the amount by default, with an open eye', () => {
    const tree = render();
    expect(textOf(tree, 'hero-available')).toBe('RM3,000.00');
    expect(tree.root.findAllByProps({ name: 'eye-outline' }).length).toBeGreaterThan(0);
    expect(toggle(tree).props.accessibilityLabel).toBe('Hide available balance');
  });

  it('masks the amount with asterisks when toggled', async () => {
    const tree = render();
    await press(tree);
    expect(textOf(tree, 'hero-available')).toBe('********');
    expect(textOf(tree, 'hero-available')).not.toContain('3,000');
    expect(tree.root.findAllByProps({ name: 'eye-off-outline' }).length).toBeGreaterThan(0);
    expect(toggle(tree).props.accessibilityLabel).toBe('Show available balance');
    expect(toggle(tree).props.accessibilityState).toEqual({ selected: true });
  });

  it('does not announce the hidden amount to a screen reader', async () => {
    const tree = render();
    const label = () => tree.root.findAllByProps({ testID: 'hero-available' }).slice(-1)[0].props
      .accessibilityLabel as string;
    expect(label()).toBe('Available, three thousand ringgit');
    await press(tree);
    expect(label()).toBe('Available balance hidden');
  });

  it('leaves spent and remaining budget visible while hidden', async () => {
    const tree = render();
    await press(tree);
    expect(textOf(tree, 'hero-spent')).toBe('RM1,160.00');
    expect(textOf(tree, 'hero-remaining')).toBe('RM1,840.00');
  });

  it('reveals the amount again on a second tap', async () => {
    const tree = render();
    await press(tree);
    await press(tree);
    expect(textOf(tree, 'hero-available')).toBe('RM3,000.00');
  });

  it('keeps the toggle a 44pt target', () => {
    const style = toggle(render()).props.style as { width: number; height: number };
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
  });
});
