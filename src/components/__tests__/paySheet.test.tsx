import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { PaySheet } from '@/components/PaySheet';
import { ToastProvider } from '@/components/ToastProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { Account } from '@/db/schema';
import type { CreditBillService } from '@/services/CreditBillService';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockPayBill = jest.fn<CreditBillService['payBill']>();
const mockCreditBillService = {
  payBill: mockPayBill,
} as unknown as CreditBillService;

const dummyAccount = {
  id: 10,
  name: 'SPayLater',
  type: 'paylater',
};

const dummyBill = {
  year: 2026,
  month: 10,
  label: 'October bill',
  outstandingSen: 41_250, // RM412.50
};

const dummySources: Account[] = [
  {
    id: 1,
    userId: 1,
    name: 'Savings',
    type: 'bank',
    balanceSen: 391_240,
    statementDay: null,
    dueDay: null,
    openingOwedSen: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 2,
    userId: 1,
    name: 'Cash Wallet',
    type: 'cash',
    balanceSen: 39_530,
    statementDay: null,
    dueDay: null,
    openingOwedSen: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 3,
    userId: 1,
    name: 'Credit Card',
    type: 'credit_card', // Credit accounts must NOT appear in sources
    balanceSen: 10_000,
    statementDay: 15,
    dueDay: 5,
    openingOwedSen: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

async function renderPaySheet(props?: Partial<React.ComponentProps<typeof PaySheet>>): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <ToastProvider>
        <ThemeProvider>
          <PaySheet
            visible={true}
            onClose={jest.fn()}
            account={dummyAccount}
            bill={dummyBill}
            sourceAccounts={dummySources}
            creditBillService={mockCreditBillService}
            onPaySuccess={jest.fn()}
            {...props}
          />
        </ThemeProvider>
      </ToastProvider>,
    );
  });
  return tree;
}

describe('PaySheet component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders caption, amountSheet, explanation, and non-credit sources', async () => {
    const tree = await renderPaySheet();

    // Caption
    const caption = tree.root.findByProps({ testID: 'pay-sheet-caption' });
    expect(caption.props.children).toEqual(['SPayLater', ' · ', 'October bill']);

    // Amount
    const amount = tree.root.findByProps({ testID: 'pay-sheet-amount' });
    expect(amount.props.children).toBe('RM412.50');

    // Only non-credit accounts are rendered in Pay From
    expect(tree.root.findByProps({ testID: 'pay-from-account-1' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'pay-from-account-2' })).toBeDefined();

    // Credit card must NOT be present
    const creditSource = tree.root.findAll(
      (node: ReactTestInstance) => node.props?.testID === 'pay-from-account-3',
    );
    expect(creditSource.length).toBe(0);
  });

  it('allows tapping amount to edit partial payment via MoneyInput', async () => {
    const tree = await renderPaySheet();

    // Tap amount to edit
    const amountTap = tree.root.findByProps({ testID: 'pay-sheet-amount-tap' });
    await act(async () => {
      amountTap.props.onPress();
    });

    // MoneyInput is now shown
    const moneyInput = tree.root.findByProps({ testID: 'pay-sheet-money-input' });
    expect(moneyInput).toBeDefined();

    // Change amount to RM200.00
    await act(async () => {
      moneyInput.props.onChangeValue('200.00');
    });

    // Pay button should now show Pay RM200.00
    const payBtn = tree.root.findByProps({ testID: 'pay-sheet-confirm' });
    const textNode = payBtn.findByProps({ children: 'Pay RM200.00' });
    expect(textNode).toBeDefined();
  });

  it('calls CreditBillService.payBill when Pay button is pressed', async () => {
    const onPaySuccess = jest.fn();
    const onClose = jest.fn();
    mockPayBill.mockResolvedValueOnce({
      id: 'p1',
      userId: '1',
      accountId: '10',
      billYear: 2026,
      billMonth: 10,
      amountSen: 41_250,
      paidDate: '2026-10-11',
      fromAccountId: '1',
      createdAt: '2026-10-11T12:00:00Z',
    });

    const tree = await renderPaySheet({ onPaySuccess, onClose });

    const payBtn = tree.root.findByProps({ testID: 'pay-sheet-confirm' });
    await act(async () => {
      await payBtn.props.onPress();
    });

    expect(mockPayBill).toHaveBeenCalledTimes(1);
    expect(mockPayBill).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 10,
        billYear: 2026,
        billMonth: 10,
        amountSen: 41_250,
        fromAccountId: 1,
      }),
    );
    expect(onPaySuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
