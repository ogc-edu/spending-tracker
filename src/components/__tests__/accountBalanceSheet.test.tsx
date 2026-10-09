/**
 * Adjust-balance flow: the account row is a button that opens
 * AccountBalanceSheet, the sheet prefills with the account's current figure,
 * entry runs through the POS MoneyInput, and Save hands back integer sen.
 * Credit cards say "owed" instead of "balance". A save failure keeps the sheet
 * open with the message inline; Cancel/scrim change nothing. The sheet also
 * rides above the soft keyboard, by the keyboard's measured height.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Dimensions, Keyboard, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { Account } from '@/db/schema';
import { AccountBalanceSheet } from '../AccountBalanceSheet';
import { AccountRow } from '../AccountRow';

/** A typed onSave stub (the prop returns void | Promise<void>). */
const saveStub = () => jest.fn<(balanceSen: number) => Promise<void>>().mockResolvedValue(undefined);

const account = (over: Partial<Account> = {}): Account =>
  ({
    id: 1,
    userId: 1,
    name: 'Wallet',
    type: 'cash',
    balanceSen: 12_050,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as Account;

function render(element: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element);
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

async function press(tree: ReactTestRenderer, testID: string): Promise<void> {
  const node = tree.root.findByProps({ testID });
  await act(async () => {
    (node.props as { onPress(): void }).onPress();
  });
}

/** Type digits into the sheet's POS amount field (the hidden digit buffer). */
async function typeAmount(tree: ReactTestRenderer, digits: string): Promise<void> {
  const matches = tree.root.findAll((n) => n.props?.testID === 'account-balance-input');
  const input = matches[matches.length - 1];
  await act(async () => {
    (input.props as { onChangeText(text: string): void }).onChangeText(digits);
  });
}

describe('AccountRow — pressing the row opens the balance sheet', () => {
  it('is a button with an adjust hint, and keeps delete separate', async () => {
    const onPress = jest.fn();
    const onDelete = jest.fn();
    const tree = render(<AccountRow account={account()} onPress={onPress} onDelete={onDelete} />);

    const row = tree.root.findByProps({ testID: 'account-row-1' });
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityHint).toBe('Adjust the balance');

    await press(tree, 'account-row-1');
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();

    await press(tree, 'account-delete-1');
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1); // the trash tap is not an "adjust"
  });

  it('says "amount owed" for a credit card', () => {
    const tree = render(
      <AccountRow
        account={account({ type: 'credit_card', name: 'Citi' })}
        onPress={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(tree.root.findByProps({ testID: 'account-row-1' }).props.accessibilityHint).toBe(
      'Adjust the amount owed',
    );
  });
});

describe('AccountBalanceSheet', () => {
  it('renders nothing until an account is passed', () => {
    const tree = render(<AccountBalanceSheet account={null} onSave={saveStub()} onCancel={jest.fn()} />);
    expect(tree.root.findAllByProps({ testID: 'account-balance-sheet' })).toHaveLength(0);
  });

  it('prefills with the current balance and shows it in the subtitle', () => {
    const tree = render(
      <AccountBalanceSheet account={account()} onSave={saveStub()} onCancel={jest.fn()} />,
    );
    expect(textOf(tree, 'account-balance-title')).toBe('Adjust balance');
    expect(textOf(tree, 'account-balance-subtitle')).toBe('Wallet · now RM120.50');
    expect(textOf(tree, 'account-balance-input-display')).toBe('RM120.50');
  });

  it('saves the typed amount as integer sen', async () => {
    const onSave = jest.fn<(sen: number) => Promise<void>>().mockResolvedValue(undefined);
    const tree = render(
      <AccountBalanceSheet account={account()} onSave={onSave} onCancel={jest.fn()} />,
    );
    await typeAmount(tree, '25075'); // POS entry: RM250.75
    expect(textOf(tree, 'account-balance-input-display')).toBe('RM250.75');

    await press(tree, 'account-balance-save');
    expect(onSave).toHaveBeenCalledWith(25_075);
  });

  it('allows zeroing an account out', async () => {
    const onSave = jest.fn<(sen: number) => Promise<void>>().mockResolvedValue(undefined);
    const tree = render(
      <AccountBalanceSheet account={account()} onSave={onSave} onCancel={jest.fn()} />,
    );
    await typeAmount(tree, '');
    await press(tree, 'account-balance-save');
    expect(onSave).toHaveBeenCalledWith(0);
  });

  it('reads as "amount owed" for a credit card', () => {
    const tree = render(
      <AccountBalanceSheet
        account={account({ type: 'credit_card', name: 'Citi', balanceSen: 50_000 })}
        onSave={saveStub()}
        onCancel={jest.fn()}
      />,
    );
    expect(textOf(tree, 'account-balance-title')).toBe('Adjust amount owed');
    expect(textOf(tree, 'account-balance-subtitle')).toBe('Citi · now RM500.00');
  });

  it('keeps the sheet open with the error when the save fails', async () => {
    const onSave = jest
      .fn<(sen: number) => Promise<void>>()
      .mockRejectedValue(new Error('database is locked'));
    const tree = render(
      <AccountBalanceSheet account={account()} onSave={onSave} onCancel={jest.fn()} />,
    );
    await press(tree, 'account-balance-save');

    expect(textOf(tree, 'account-balance-error')).toBe('database is locked');
    expect(tree.root.findAllByProps({ testID: 'account-balance-sheet' }).length).toBeGreaterThan(0);
    // Still usable: the save button is re-enabled.
    expect(tree.root.findByProps({ testID: 'account-balance-save' }).props.disabled).toBe(false);
  });

  it('cancels without saving', async () => {
    const onSave = jest.fn<(sen: number) => Promise<void>>().mockResolvedValue(undefined);
    const onCancel = jest.fn();
    const tree = render(
      <AccountBalanceSheet account={account()} onSave={onSave} onCancel={onCancel} />,
    );
    await typeAmount(tree, '9999');
    await press(tree, 'account-balance-cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});


/* ---------------- keyboard-aware: the sheet rides above the keyboard ---------------- */

describe('AccountBalanceSheet — keyboard handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pads the overlay by the real keyboard height while it is open', async () => {
    const handlers: Record<string, (event: { endCoordinates: { height: number } }) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: never) => {
      handlers[event] = cb as never;
      return { remove: jest.fn() };
    }) as never);

    const tree = render(
      <AccountBalanceSheet account={account()} onSave={saveStub()} onCancel={jest.fn()} />,
    );
    const overlay = () => tree.root.find((n) => n.props?.collapsable === false);
    const padding = (): number | undefined =>
      (StyleSheet.flatten(overlay().props.style) as { paddingBottom?: number }).paddingBottom;

    expect(padding()).toBe(0);

    // The overlay is full-screen, so the covered strip is the keyboard itself.
    const keyboardHeight = 336;
    (overlay().instance as unknown as { measureInWindow: unknown }).measureInWindow = (
      cb: (x: number, y: number, w: number, h: number) => void,
    ) => cb(0, 0, 400, Dimensions.get('window').height);

    await act(async () => {
      handlers.keyboardWillShow({ endCoordinates: { height: keyboardHeight } });
    });
    expect(padding()).toBe(keyboardHeight); // the card rides up by exactly this

    await act(async () => {
      (handlers.keyboardWillHide as unknown as () => void)();
    });
    expect(padding()).toBe(0); // …and settles back when the keyboard closes
  });
});
