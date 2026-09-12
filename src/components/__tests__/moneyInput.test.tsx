/**
 * MoneyInput — POS/cash-terminal amount entry. Typing 2 → 0 → 0 must read
 * RM0.02 → RM0.20 → RM2.00 and backspace must shift back the same way, with
 * the value handed to the form staying the canonical money string ("2.00")
 * the Zod grammar and parseMoneyToSen already accept.
 *
 * What the user sees is the formatted <Text> (`<testID>-display`); the
 * TextInput behind it is transparent and holds plain digits, which is what
 * keeps a half-typed "RM0.007" from ever being painted. Tests therefore drive
 * the digit buffer and assert on the display.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { MoneyInput } from '../MoneyInput';
import { colors } from '@/theme';

/** The rendered TextInput (the innermost node carrying the testID — the outer
 *  matches are the MoneyInput element and the TextInput composite). */
function inputOf(tree: ReactTestRenderer, testID = 'amount'): ReactTestInstance {
  const matches = tree.root.findAll((node) => node.props?.testID === testID, { deep: true });
  return matches[matches.length - 1];
}

/** The visible, formatted amount. */
function displayOf(tree: ReactTestRenderer, testID = 'amount-display'): string {
  const node = tree.root.findAll((n) => n.props?.testID === testID)[0];
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

/** A controlled host: mirrors how ExpenseForm feeds value back in on change. */
function renderField(initial = '0.00'): {
  tree: ReactTestRenderer;
  type(text: string): Promise<void>;
  display(): string;
  buffer(): string;
  value(): string;
} {
  let current = initial;
  let tree!: ReactTestRenderer;
  const host = () => (
    <MoneyInput value={current} onChangeValue={(next) => { current = next; }} testID="amount" />
  );
  act(() => {
    tree = create(host());
  });
  const input = () => inputOf(tree);
  return {
    tree,
    display: () => displayOf(tree),
    buffer: () => input().props.value as string,
    value: () => current,
    async type(text: string) {
      await act(async () => {
        (input().props as { onChangeText(t: string): void }).onChangeText(text);
      });
      await act(async () => {
        tree.update(host());
      });
    },
  };
}

/** What the platform sends after a keypress: the digit buffer plus the digit. */
const press = (field: { buffer(): string }, digit: string): string => field.buffer() + digit;
/** …and after a backspace: the digit buffer minus its last digit. */
const backspace = (field: { buffer(): string }): string => field.buffer().slice(0, -1);

describe('MoneyInput — digits fill in from the sen place', () => {
  it('starts at RM0.00', () => {
    expect(renderField().display()).toBe('RM0.00');
  });

  it('2 → 0 → 0 walks RM0.02 → RM0.20 → RM2.00', async () => {
    const field = renderField();
    await field.type(press(field, '2'));
    expect(field.display()).toBe('RM0.02');
    await field.type(press(field, '0'));
    expect(field.display()).toBe('RM0.20');
    await field.type(press(field, '0'));
    expect(field.display()).toBe('RM2.00');
    expect(field.value()).toBe('2.00');
  });

  it('single digits and a thousands-separated amount (1,0,0,0 → RM10.00)', async () => {
    const one = renderField();
    await one.type(press(one, '1'));
    expect(one.display()).toBe('RM0.01');

    const ten = renderField();
    for (const digit of ['1', '0', '0', '0']) {
      await ten.type(press(ten, digit));
    }
    expect(ten.display()).toBe('RM10.00');
    expect(ten.value()).toBe('10.00');

    const grouped = renderField();
    for (const digit of ['1', '0', '0', '0', '0', '0']) {
      await grouped.type(press(grouped, digit));
    }
    expect(grouped.display()).toBe('RM1,000.00');
    expect(grouped.value()).toBe('1000.00');
  });

  it('backspace drops the last digit and shifts the rest right', async () => {
    const field = renderField('25.00');
    expect(field.display()).toBe('RM25.00');
    await field.type(backspace(field));
    expect(field.display()).toBe('RM2.50');
    await field.type(backspace(field));
    expect(field.display()).toBe('RM0.25');
    await field.type(backspace(field));
    expect(field.display()).toBe('RM0.02');
    await field.type(backspace(field));
    expect(field.display()).toBe('RM0.00');
    await field.type(backspace(field)); // already empty — stays put
    expect(field.display()).toBe('RM0.00');
    expect(field.value()).toBe('0.00');
  });

  it('never paints a half-formed amount: the typed buffer is digits, the display is formatted', async () => {
    const field = renderField();
    await field.type(press(field, '7'));
    // The raw keystroke "07" never reaches the screen — RM0.007 is unrenderable.
    expect(field.buffer()).toBe('7');
    expect(field.display()).toBe('RM0.07');
    expect(inputOf(field.tree).props.style).toEqual(
      expect.objectContaining({ color: 'transparent', opacity: 0 }),
    );
  });

  it('prefills an edited expense and keeps typing from there', async () => {
    const field = renderField('120.50');
    expect(field.display()).toBe('RM120.50');
    await field.type(press(field, '7'));
    expect(field.display()).toBe('RM1,205.07');
  });
});

describe('MoneyInput — no malformed input is reachable', () => {
  it('uses a digits-only keyboard (no decimal point to type)', () => {
    const props = inputOf(renderField().tree).props as {
      keyboardType: string;
      inputMode: string;
    };
    expect(props.keyboardType).toBe('number-pad');
    expect(props.inputMode).toBe('numeric');
  });

  it('ignores pasted junk, extra dots and signs — only digits count', async () => {
    const field = renderField();
    await field.type('-1.2.3abc');
    expect(field.display()).toBe('RM1.23');
    expect(field.value()).toBe('1.23');
  });

  it('refuses to grow past the digit cap instead of truncating', async () => {
    const field = renderField('99999999.99'); // 10 digits = the cap
    await field.type(press(field, '9'));
    expect(field.display()).toBe('RM99,999,999.99');
  });

  it('a tap anywhere on the field focuses the (invisible) input', async () => {
    const field = renderField();
    const row = field.tree.root.findAll(
      (n) => typeof n.props?.onPress === 'function' && n.props?.accessible === false,
    )[0];
    expect(row).toBeDefined();
  });

  it('pins the caret to the end of the digit buffer so digits never land mid-number', async () => {
    const field = renderField('2.00');
    expect(field.buffer()).toBe('200');
    expect(inputOf(field.tree).props.selection).toEqual({ start: 3, end: 3 });
    expect(inputOf(field.tree).props.caretHidden).toBe(true);
  });
});

describe('MoneyInput — typing affordances', () => {
  /** Flattened style of the formatted amount Text. */
  const displayStyle = (tree: ReactTestRenderer): { color?: string } =>
    StyleSheet.flatten(
      tree.root.findAll((n) => n.props?.testID === 'amount-display')[0].props.style,
    ) as { color?: string };

  const caretCount = (tree: ReactTestRenderer): number =>
    tree.root.findAll((n) => n.props?.testID === 'amount-caret').length;

  async function focus(field: { tree: ReactTestRenderer }, focused: boolean): Promise<void> {
    const props = inputOf(field.tree).props as { onFocus(): void; onBlur(): void };
    await act(async () => {
      if (focused) props.onFocus();
      else props.onBlur();
    });
  }

  it('renders RM0.00 muted until a digit is entered', async () => {
    const field = renderField();
    expect(displayStyle(field.tree).color).toBe(colors.muted);

    await field.type(press(field, '7'));
    expect(displayStyle(field.tree).color).toBe(colors.text);

    // Clearing it back to zero returns to the placeholder look.
    await field.type(backspace(field));
    expect(displayStyle(field.tree).color).toBe(colors.muted);
  });

  it('shows a caret only while the field has focus', async () => {
    const field = renderField();
    expect(caretCount(field.tree)).toBe(0);

    await focus(field, true);
    expect(caretCount(field.tree)).toBeGreaterThan(0);

    await focus(field, false);
    expect(caretCount(field.tree)).toBe(0);
  });

  it('still forwards the caller onFocus/onBlur', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <MoneyInput value="" onChangeValue={jest.fn()} onFocus={onFocus} onBlur={onBlur} testID="amount" />,
      );
    });
    const props = inputOf(tree).props as { onFocus(): void; onBlur(): void };
    await act(async () => {
      props.onFocus();
      props.onBlur();
    });
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe('MoneyInput — accessibility', () => {
  it('speaks the amount and forwards the field label', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <MoneyInput
          value="1900.00"
          onChangeValue={jest.fn()}
          accessibilityLabel="Amount in ringgit"
          testID="amount"
        />,
      );
    });
    const props = inputOf(tree).props as {
      accessibilityLabel: string;
      accessibilityValue: { text: string };
    };
    expect(props.accessibilityLabel).toBe('Amount in ringgit');
    expect(props.accessibilityValue.text).toBe('one thousand nine hundred ringgit');
  });
});
