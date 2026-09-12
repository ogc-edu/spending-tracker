/**
 * Plan 016 — ToastProvider tests: transient ≈2.5 s auto-dismiss, one at a
 * time (a second show replaces the first and resets the timer), non-modal
 * (pointerEvents none). Animated.timing is stubbed so fake-timer advance
 * only drives the dismissal timeout.
 */
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { Animated } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { ToastProvider, TOAST_DURATION_MS, useToast } from '../ToastProvider';

// The app root provides a real SafeAreaProvider; here a stub keeps the
// provider's children rendering in the test renderer (the native provider
// renders nothing in Jest).
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.spyOn(Animated, 'timing').mockReturnValue({ start: () => {} } as never);

const TOAST_TEST = 'toast-message';

function Probe({ onShow }: { onShow(show: (message: string) => void): void }) {
  const { show } = useToast();
  onShow(show);
  return null;
}

function textOf(root: ReactTestInstance): string {
  const texts: string[] = [];
  const collect = (node: ReactTestInstance): void => {
    for (const child of node.children) {
      if (typeof child === 'string') texts.push(child);
      else collect(child);
    }
  };
  collect(root);
  return texts.join('');
}

async function renderToastHost(): Promise<{ tree: ReactTestRenderer; show: (message: string) => void }> {
  let show!: (message: string) => void;
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <ToastProvider>
        <Probe onShow={(fn) => (show = fn)} />
      </ToastProvider>,
    );
  });
  return { tree, show };
}

/** The toast's HOST node (Animated.View forwards testID to the real View). */
function hostToast(tree: ReactTestRenderer, testID: string): ReactTestInstance {
  const matches = tree.root.findAll((node) => node.props?.testID === testID && typeof node.type === 'string');
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

describe('ToastProvider (plan 016)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the message and auto-dismisses after ~2.5s', async () => {
    const { tree, show } = await renderToastHost();
    await act(async () => {
      show('Could not delete expense');
    });
    const toast = hostToast(tree, TOAST_TEST);
    expect(textOf(toast)).toContain('Could not delete expense');
    expect(toast.props.pointerEvents).toBe('none'); // non-modal

    await act(async () => {
      jest.advanceTimersByTime(TOAST_DURATION_MS - 100);
    });
    expect(hostToast(tree, TOAST_TEST)).toBeDefined();

    await act(async () => {
      jest.advanceTimersByTime(150);
    });
    expect(tree.root.findAllByProps({ testID: TOAST_TEST })).toHaveLength(0);
  });

  it('one at a time — a second show replaces the first', async () => {
    const { tree, show } = await renderToastHost();
    await act(async () => {
      show('First failure');
      show('Second failure');
    });
    const toasts = tree.root.findAllByProps({ testID: TOAST_TEST });
    const host = hostToast(tree, TOAST_TEST);
    expect(textOf(host)).toContain('Second failure');
    expect(textOf(host)).not.toContain('First failure');
    expect(toasts.length).toBeGreaterThanOrEqual(1); // one visible toast (host only)
  });
});