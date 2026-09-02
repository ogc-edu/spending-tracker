/**
 * Plan 014 — shared AIAnalysisCard states (react-test-renderer):
 * idle → null; pending (label header + spinner); result (summary + ≤5
 * points); typed error per reason (fixed label, never raw provider text) +
 * Retry firing onRetry; `unknown` surfaces a contextual message (e.g. "No AI
 * provider configured"). The same contract powers 015 ("Explain my
 * allowance").
 */
import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { AIUnavailableError } from '@/ai/errors';
import type { AIErrorReason } from '@/ai/types';
import { AIAnalysisCard, AI_ERROR_LABELS, type AIAnalysisState } from '../AIAnalysisCard';

/** Flatten every Text child under the element with the given testID. */
function textOf(root: ReactTestInstance, testID: string): string {
  const el = byTestID(root, testID);
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

function byTestID(root: ReactTestInstance, testID: string): ReactTestInstance {
  const matches = root.findAllByProps({ testID });
  const el = matches[matches.length - 1];
  if (!el) throw new Error(`no element with testID ${testID}`);
  return el;
}

function hasTestID(root: ReactTestInstance, testID: string): boolean {
  return root.findAllByProps({ testID }).length > 0;
}

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

async function press(tree: ReactTestRenderer, testID: string): Promise<void> {
  const matches = tree.root.findAllByProps({ testID });
  const el =
    matches.find((m) => typeof (m.props as { onPress?: unknown }).onPress === 'function') ??
    matches[matches.length - 1]!;
  await act(async () => {
    (el.props as { onPress: () => void }).onPress();
  });
}

const idleState: AIAnalysisState = {
  pending: false,
  error: null,
  result: null,
  onRetry: () => {},
};

describe('AIAnalysisCard — idle', () => {
  it('renders nothing when nothing is in flight', async () => {
    const tree = await render(<AIAnalysisCard {...idleState} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('renders nothing when only a label is set (no activity)', async () => {
    const tree = await render(<AIAnalysisCard {...idleState} label="August 2026" />);
    expect(tree.toJSON()).toBeNull();
  });
});

describe('AIAnalysisCard — pending', () => {
  it('shows the label header + analyzing caption', async () => {
    const tree = await render(
      <AIAnalysisCard
        {...idleState}
        pending
        label="August 2026"
      />,
    );
    expect(hasTestID(tree.root, 'ai-analysis-card')).toBe(true);
    expect(textOf(tree.root, 'ai-analysis-label')).toBe('August 2026');
    expect(textOf(tree.root, 'ai-analysis-pending')).toContain('Analyzing');
  });
});

describe('AIAnalysisCard — result', () => {
  it('renders the summary and every point (≤5, Zod-validated upstream)', async () => {
    const tree = await render(
      <AIAnalysisCard
        {...idleState}
        result={{
          summary: 'Food dominated August.',
          points: ['Food was RM127.50.', 'Transport edged up.', 'Pace is on track.'],
        }}
        label="August 2026"
      />,
    );
    expect(textOf(tree.root, 'ai-analysis-result')).toContain('Food dominated August.');
    expect(textOf(tree.root, 'ai-analysis-point-0')).toContain('Food was RM127.50.');
    expect(textOf(tree.root, 'ai-analysis-point-1')).toContain('Transport edged up.');
    expect(textOf(tree.root, 'ai-analysis-point-2')).toContain('Pace is on track.');
    expect(hasTestID(tree.root, 'ai-analysis-point-3')).toBe(false);
  });
});

describe('AIAnalysisCard — typed error + Retry', () => {
  it.each(
    [
      'offline',
      'timeout',
      'http',
      'invalidKey',
      'modelUnavailable',
      'invalidResponse',
    ] as AIErrorReason[],
  )('reason "%s" renders its fixed label, never raw provider text', async (reason) => {
    const tree = await render(
      <AIAnalysisCard
        {...idleState}
        error={new AIUnavailableError(reason, 'secret raw provider string')}
        label="August 2026"
        onRetry={() => {}}
      />,
    );
    expect(hasTestID(tree.root, 'ai-analysis-error')).toBe(true);
    expect(textOf(tree.root, 'ai-analysis-error-message')).toBe(AI_ERROR_LABELS[reason]);
    expect(textOf(tree.root, 'ai-analysis-error-message')).not.toContain('secret raw');
  });

  it('retry fires the caller callback', async () => {
    const retried = jest.fn();
    const tree = await render(
      <AIAnalysisCard
        {...idleState}
        error={new AIUnavailableError('offline', 'offline')}
        onRetry={retried}
      />,
    );
    await press(tree, 'ai-analysis-retry');
    expect(retried).toHaveBeenCalledTimes(1);
  });

  it('unknown surfaces a contextual message (e.g. "No AI provider configured")', async () => {
    const tree = await render(
      <AIAnalysisCard
        {...idleState}
        error={new AIUnavailableError('unknown', 'No AI provider configured')}
        onRetry={() => {}}
      />,
    );
    expect(textOf(tree.root, 'ai-analysis-error-message')).toBe('No AI provider configured');
  });
});