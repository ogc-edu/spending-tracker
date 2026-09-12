/**
 * Stack route titles — every pushed route must be registered in its layout
 * with an explicit title. An unregistered route falls back to its file path,
 * which is how the commitment edit screen came to show "[id]/edit" in the
 * header. These assertions pin the registered set for both stacks.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import CommitmentsLayout from '@/app/commitments/_layout';
import ExpensesLayout from '@/app/expenses/_layout';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('Stack', null, children);
  Stack.displayName = 'Stack';
  const Screen = (props: { name: string; options?: { title?: string } }) =>
    React.createElement('StackScreen', props);
  Screen.displayName = 'Stack.Screen';
  Stack.Screen = Screen;
  return { Stack };
});

/** name → title for every <Stack.Screen> the layout registers. */
function registeredTitles(element: React.ReactElement): Record<string, string | undefined> {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element);
  });
  // The mock renders each <Stack.Screen> as a host element of this name.
  const screens = tree.root.findAll((node) => (node.type as unknown as string) === 'StackScreen');
  return Object.fromEntries(
    screens.map((screen) => [
      screen.props.name as string,
      (screen.props.options as { title?: string } | undefined)?.title,
    ]),
  );
}

describe('Commitments stack', () => {
  it('gives every route a title — including [id]/edit', () => {
    expect(registeredTitles(<CommitmentsLayout />)).toEqual({
      new: 'Add commitment',
      '[id]/index': 'Commitment',
      '[id]/edit': 'Edit commitment',
    });
  });
});

describe('Expenses stack', () => {
  it('gives every route a title', () => {
    expect(registeredTitles(<ExpensesLayout />)).toEqual({
      new: 'Add expense',
      '[id]/index': 'Expense',
      '[id]/edit': 'Edit expense',
    });
  });
});
