/**
 * KeyboardAwareScrollView — the focused input is lifted above the soft
 * keyboard using measured geometry only (real keyboard height from the
 * Keyboard event, real frames from measureInWindow). Covered: the pure
 * offset/overlap math, the measured scroll on focus, "already visible" ⇒ no
 * scroll (scroll position preserved), and the inset appearing only while the
 * keyboard is up.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Dimensions, Keyboard, StyleSheet, Text, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  KeyboardAwareScrollView,
  keyboardOverlap,
  scrollOffsetFor,
} from '../KeyboardAwareScrollView';
import { ExpenseForm } from '../ExpenseForm';
import type { Account, Category } from '@/db/schema';
import { spacing } from '@/theme';

const GAP = spacing.lg;

describe('keyboardOverlap — the covered strip of the scroll view', () => {
  it('is the part below the keyboard top', () => {
    expect(keyboardOverlap(800, 500)).toBe(300);
  });

  it('is 0 when the window already resized above the keyboard (no empty gap)', () => {
    expect(keyboardOverlap(500, 500)).toBe(0);
    expect(keyboardOverlap(480, 500)).toBe(0);
  });
});

describe('scrollOffsetFor — minimal, measured correction', () => {
  const base = { scrollTop: 0, scrollBottom: 800, keyboardTop: 500, offset: 0 };

  it('lifts an input covered by the keyboard by exactly the overlap plus the gap', () => {
    // input 600..648 → must end at 500 - GAP
    expect(scrollOffsetFor({ ...base, inputTop: 600, inputBottom: 648 })).toBe(648 - (500 - GAP));
  });

  it('adds to the current offset instead of jumping to an absolute position', () => {
    expect(scrollOffsetFor({ ...base, offset: 120, inputTop: 600, inputBottom: 648 })).toBe(
      120 + 648 - (500 - GAP),
    );
  });

  it('returns null when the input already sits in the visible strip (no jump)', () => {
    expect(scrollOffsetFor({ ...base, inputTop: 300, inputBottom: 348 })).toBeNull();
    expect(scrollOffsetFor({ ...base, inputTop: 100, inputBottom: 148 })).toBeNull();
  });

  it('never pushes the focused input off the top edge', () => {
    // Taller than the visible strip: aligns to the top, not beyond it.
    const next = scrollOffsetFor({ ...base, inputTop: 20, inputBottom: 700 });
    expect(next).toBe(20 - GAP > 0 ? 20 - GAP : null);
  });

  it('scrolls back up when the input is above the visible strip', () => {
    expect(scrollOffsetFor({ ...base, offset: 300, inputTop: -40, inputBottom: 8 })).toBe(
      300 - (GAP + 40),
    );
    // …and never past the top of the content.
    expect(scrollOffsetFor({ ...base, offset: 10, inputTop: -400, inputBottom: -352 })).toBe(0);
  });

  it('uses the scroll view frame when it is shallower than the keyboard top', () => {
    // Window resized (Android adjustResize): the strip ends at the view, not the keyboard.
    expect(
      scrollOffsetFor({ ...base, scrollBottom: 400, keyboardTop: 500, inputTop: 360, inputBottom: 408 }),
    ).toBe(408 - (400 - GAP));
  });
});

/* ---------------- component behavior ---------------- */

const WINDOW_HEIGHT = Dimensions.get('window').height;
const KEYBOARD_HEIGHT = 336;
const KEYBOARD_TOP = WINDOW_HEIGHT - KEYBOARD_HEIGHT;

type ShowHandler = (event: { endCoordinates: { height: number } }) => void;

/**
 * Mount the scroller with a stubbed focused input and a captured Keyboard
 * listener pair. The scroll view spans the window (the iOS / Android
 * edge-to-edge case, where the window does not resize under the keyboard).
 */
function mounted(inputFrame: { y: number; height: number }) {
  const handlers: Record<string, ShowHandler> = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: ShowHandler) => {
    handlers[event] = cb;
    return { remove: jest.fn() };
  }) as never);

  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
    measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
      cb(0, inputFrame.y, 300, inputFrame.height),
  } as never);

  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <KeyboardAwareScrollView testID="screen">
        <Text>form</Text>
      </KeyboardAwareScrollView>,
    );
  });

  // The ScrollView the component scrolls — its mock instance carries scrollTo.
  const scrollNode = () =>
    tree.root.find(
      (node) => node.props?.testID === 'screen' && node.props?.keyboardShouldPersistTaps !== undefined,
    );
  const scrollTo = jest.fn();
  (scrollNode().instance as unknown as { scrollTo: unknown }).scrollTo = scrollTo;

  // The wrapper View whose frame the component measures: the RN test mock has
  // measureInWindow but never calls back, so give it the window frame.
  const container = tree.root.find((node) => node.props?.collapsable === false);
  (container.instance as unknown as { measureInWindow: unknown }).measureInWindow = (
    cb: (x: number, y: number, w: number, h: number) => void,
  ) => cb(0, 0, 400, WINDOW_HEIGHT);

  return {
    tree,
    scrollTo,
    scrollProps: () => scrollNode().props as unknown as Record<string, unknown>,
    contentPadding: () =>
      (StyleSheet.flatten(scrollNode().props.contentContainerStyle) as { paddingBottom?: number })
        .paddingBottom,
    async showKeyboard(height = KEYBOARD_HEIGHT) {
      await act(async () => {
        handlers.keyboardWillShow({ endCoordinates: { height } });
      });
    },
    async hideKeyboard() {
      await act(async () => {
        (handlers.keyboardWillHide as unknown as () => void)();
      });
    },
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('KeyboardAwareScrollView', () => {
  it('scrolls a keyboard-covered input into view when the keyboard opens', async () => {
    const inputTop = KEYBOARD_TOP + 40; // 40pt behind the keyboard
    const field = mounted({ y: inputTop, height: 48 });
    await field.showKeyboard();

    expect(field.scrollTo).toHaveBeenCalledTimes(1);
    expect(field.scrollTo).toHaveBeenCalledWith({
      y: inputTop + 48 - (KEYBOARD_TOP - GAP),
      animated: true,
    });
  });

  it('adapts to a different keyboard height (nothing is hard-coded)', async () => {
    const inputTop = WINDOW_HEIGHT - 200;
    const field = mounted({ y: inputTop, height: 48 });
    await field.showKeyboard(500); // a taller keyboard on another device
    expect(field.scrollTo).toHaveBeenCalledWith({
      y: inputTop + 48 - (WINDOW_HEIGHT - 500 - GAP),
      animated: true,
    });
  });

  it('leaves the scroll position alone when the focused input is already visible', async () => {
    const field = mounted({ y: 120, height: 48 });
    await field.showKeyboard();
    expect(field.scrollTo).not.toHaveBeenCalled();
  });

  it('pads the content by the real covered strip only while the keyboard is up', async () => {
    const field = mounted({ y: 120, height: 48 });
    expect(field.contentPadding()).toBeUndefined();

    await field.showKeyboard();
    expect(field.contentPadding()).toBe(KEYBOARD_HEIGHT + GAP);

    await field.hideKeyboard();
    expect(field.contentPadding()).toBeUndefined(); // no leftover empty area
  });

  it('keeps taps working while the keyboard is up and dismisses naturally', () => {
    const field = mounted({ y: 120, height: 48 });
    expect(field.scrollProps().keyboardShouldPersistTaps).toBe('handled');
    expect(field.scrollProps().keyboardDismissMode).toBe('interactive'); // ios preset
    expect(field.scrollProps().scrollEventThrottle).toBe(16);
  });

  it('does nothing before the keyboard is known (no scroll on mount)', () => {
    const field = mounted({ y: KEYBOARD_TOP + 40, height: 48 });
    expect(field.scrollTo).not.toHaveBeenCalled();
    expect(field.contentPadding()).toBeUndefined();
  });
});

/* ------------- wiring: every expense text input reports its focus ------------- */

const categories = [
  { id: 1, name: 'Food', icon: 'restaurant-outline', type: 'expense', createdAt: 0 },
] as unknown as Category[];
const accounts = [
  { id: 1, name: 'Cash', type: 'cash', balanceSen: 100000, createdAt: 0, updatedAt: 0, userId: 1 },
] as unknown as Account[];

describe('ExpenseForm inside the keyboard-aware scroller', () => {
  it('lifts whichever input is focused — amount and description alike', async () => {
    const handlers: Record<string, ShowHandler> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: ShowHandler) => {
      handlers[event] = cb;
      return { remove: jest.fn() };
    }) as never);
    // Whatever is focused sits behind the keyboard.
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
      measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
        cb(0, KEYBOARD_TOP + 60, 300, 48),
    } as never);

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <KeyboardAwareScrollView testID="screen">
          <ExpenseForm
            categories={categories}
            accounts={accounts}
            defaults={{ date: '2026-09-12', categoryId: 1, accountId: 1, amount: '12.00' }}
            onSubmit={jest.fn(async () => {})}
            submitting={false}
            onCancel={jest.fn()}
            onCreateCategory={jest.fn(async () => categories[0])}
            onDeleteCategory={jest.fn(async () => {})}
          />
        </KeyboardAwareScrollView>,
      );
    });

    const scrollTo = jest.fn();
    const scrollNode = tree.root.find(
      (node) => node.props?.testID === 'screen' && node.props?.keyboardShouldPersistTaps !== undefined,
    );
    (scrollNode.instance as unknown as { scrollTo: unknown }).scrollTo = scrollTo;
    const container = tree.root.find((node) => node.props?.collapsable === false);
    (container.instance as unknown as { measureInWindow: unknown }).measureInWindow = (
      cb: (x: number, y: number, w: number, h: number) => void,
    ) => cb(0, 0, 400, WINDOW_HEIGHT);

    await act(async () => {
      handlers.keyboardWillShow({ endCoordinates: { height: KEYBOARD_HEIGHT } });
    });
    scrollTo.mockClear();

    // Focusing each input runs the same reveal (the keyboard is already open,
    // so no keyboard event fires — this is the "tap the bottom field" case).
    for (const testID of ['expense-form-amount', 'expense-form-description']) {
      const nodes = tree.root.findAll((node) => node.props?.testID === testID);
      const focusable = nodes.find((node) => typeof node.props.onFocus === 'function');
      expect(focusable).toBeDefined();
      await act(async () => {
        (focusable!.props as { onFocus(): void }).onFocus();
      });
      expect(scrollTo).toHaveBeenCalledWith({
        y: KEYBOARD_TOP + 60 + 48 - (KEYBOARD_TOP - GAP),
        animated: true,
      });
      scrollTo.mockClear();
    }
  });
});
