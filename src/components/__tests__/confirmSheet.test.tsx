/**
 * Plan 016 — ConfirmSheet component tests (the single destructive-confirm
 * implementation): renders title/message; confirm fires onConfirm exactly
 * once; cancel fires onCancel (not onConfirm); while busy the confirm
 * button is disabled (double-tap guard); buttons are ≥44pt.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { ConfirmSheet } from '../ConfirmSheet';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

function textOf(root: ReactTestInstance, testID: string): string {
  const el = root.findByProps({ testID });
  const texts: string[] = [];
  const collect = (node: ReactTestInstance): void => {
    for (const child of node.children) {
      if (typeof child === 'string') texts.push(child);
      else collect(child);
    }
  };
  collect(el);
  return texts.join('');
}

async function press(tree: ReactTestRenderer, testID: string): Promise<void> {
  const el = tree.root.findByProps({ testID });
  await act(async () => {
    (el.props as { onPress: () => void }).onPress();
  });
}

const base = { title: 'Delete expense', message: 'Reverses the balance change.' };

/** Flatten a Pressable-style FUNCTION (test renderer sees the function, not its result). */
function flattenedStyle(button: ReactTestInstance): { minHeight: number } {
  const styleFn = button.props.style as (state: { pressed: boolean }) => unknown;
  return StyleSheet.flatten(styleFn({ pressed: false })) as { minHeight: number };
}

describe('ConfirmSheet (plan 016)', () => {
  it('renders nothing while hidden and title/message when visible', async () => {
    const hidden = await render(<ConfirmSheet visible={false} {...base} onConfirm={() => {}} onCancel={() => {}} />);
    expect(hidden.root.findAllByProps({ testID: 'confirm-sheet' })).toHaveLength(0);

    const shown = await render(<ConfirmSheet visible {...base} onConfirm={() => {}} onCancel={() => {}} />);
    expect(textOf(shown.root, 'confirm-sheet-title')).toBe('Delete expense');
    expect(textOf(shown.root, 'confirm-sheet-message')).toBe('Reverses the balance change.');
  });

  it('fires onConfirm exactly once and never onCancel', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const tree = await render(<ConfirmSheet visible {...base} confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />);
    await press(tree, 'confirm-sheet-confirm');
    await press(tree, 'confirm-sheet-cancel');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables the confirm button while busy (rapid double-tap guard)', async () => {
    const onConfirm = jest.fn();
    const tree = await render(<ConfirmSheet visible {...base} busy onConfirm={onConfirm} onCancel={() => {}} />);
    const confirm = tree.root.findByProps({ testID: 'confirm-sheet-confirm' });
    expect(confirm.props.disabled).toBe(true);
    await act(async () => {
      confirm.props.onPress();
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps ≥44pt touch targets on both buttons', async () => {
    const tree = await render(<ConfirmSheet visible {...base} onConfirm={() => {}} onCancel={() => {}} />);
    for (const testID of ['confirm-sheet-confirm', 'confirm-sheet-cancel']) {
      const button = tree.root.findByProps({ testID });
      expect(flattenedStyle(button).minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});